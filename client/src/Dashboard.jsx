import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { api } from './api.js';
import VitalsForm from './VitalsForm.jsx';
import SignModal from './SignModal.jsx';

/**
 * Main workspace. Shows subjects, the selected subject's forms, data entry, the
 * signing flow, and (for authorized roles) export. Action buttons are shown/hidden
 * by role for convenience only — the server independently enforces every action.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [forms, setForms] = useState([]);
  const [visits, setVisits] = useState([]);
  const [signing, setSigning] = useState(null);
  const [message, setMessage] = useState(null);

  const canWriteForm = ['Investigator', 'DataManager'].includes(user.role);
  const canSign = ['Investigator', 'DataManager'].includes(user.role);
  const canExport = user.role === 'DataManager' || user.role === 'Administrator';
  const canEnrol = user.role === 'Investigator';

  const loadSubjects = useCallback(async () => {
    try { setSubjects(await api.listSubjects()); } catch (e) { setMessage(e.message); }
  }, []);
  const loadForms = useCallback(async (subjectId) => {
    try { setForms(await api.listForms(subjectId)); } catch (e) { setMessage(e.message); }
  }, []);
  const loadVisits = useCallback(async (subjectId) => {
    try { setVisits(await api.listVisits(subjectId)); } catch (e) { setMessage(e.message); }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);
  useEffect(() => {
    if (!selected) return;
    loadForms(selected._id);
    loadVisits(selected._id);
  }, [selected, loadForms, loadVisits]);

  async function enrol() {
    const code = `S-${Math.floor(Math.random() * 9000 + 1000)}`;
    try {
      // studyId is required; use the first subject's study, or prompt would go here.
      const studyId = subjects[0]?.studyId;
      if (!studyId) { setMessage('No study available to enrol into (seed the study first).'); return; }
      await api.enrolSubject({ studyId, subjectCode: code });
      loadSubjects();
    } catch (e) { setMessage(e.message); }
  }

  async function doExport() {
    try {
      const result = await api.exportDataset();
      const blob = new Blob([result.files['dataset.json']], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'dataset.json'; a.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported. Checksum (dataset.json): ${result.manifest.checksums['dataset.json'].slice(0, 16)}…`);
    } catch (e) { setMessage(e.message); }
  }

  return (
    <div>
      {message && <div className="card" style={{ background: '#fff8e1' }}>{message}</div>}
      <div className="card">
        <h3>Subjects
          {canEnrol && <button style={{ float: 'right' }} onClick={enrol}>Enrol subject</button>}
          {canExport && <button className="secondary" style={{ float: 'right', marginRight: 8 }} onClick={doExport}>Export dataset</button>}
        </h3>
        <table>
          <thead><tr><th>Subject</th><th>Status</th><th>Enrolled (UTC)</th><th /></tr></thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s._id}>
                <td>{s.subjectCode}</td>
                <td>{s.status}</td>
                <td className="muted">{new Date(s.enrolledAtUTC).toISOString()}</td>
                <td><button className="secondary" onClick={() => setSelected(s)}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <h3>Forms for {selected.subjectCode}</h3>
          <table>
            <thead><tr><th>Type</th><th>Version</th><th>Status</th><th>Data</th><th /></tr></thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f._id}>
                  <td>{f.type}</td>
                  <td>{f.version}</td>
                  <td>
                    {f.status}{' '}
                    {f.locked && <span className="pill locked">locked</span>}
                    {f.status === 'signed' && <span className="pill signed">signed</span>}
                  </td>
                  <td className="muted">{JSON.stringify(f.data)}</td>
                  <td>
                    {canSign && !f.locked && <button onClick={() => setSigning(f._id)}>Sign</button>}
                    {f.locked && <span className="muted">read-only (amend to change)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canWriteForm && visits.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Enter vital signs</h4>
              <VitalsForm
                subjectId={selected._id}
                visitId={visits[0]._id}
                onCreated={() => loadForms(selected._id)}
              />
            </div>
          )}
        </div>
      )}

      {signing && (
        <SignModal
          formId={signing}
          onClose={() => setSigning(null)}
          onSigned={() => { setSigning(null); loadForms(selected._id); }}
        />
      )}
    </div>
  );
}
