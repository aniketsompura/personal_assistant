import * as stylex from '@stylexjs/stylex';
import { useRef, useState } from 'react';
import { useStore, validateExport } from '../data/store';
import type { ExportFile, Settings } from '../data/types';
import { getCapability, inClaudeArtifact } from '../lib/claude';
import { todayISO } from '../lib/dates';
import { useThemePref, type ThemePref } from '../app/theme';
import { color, font, radius, space, text } from '../styles/tokens.stylex';
import { Frame } from '../components/Frame';
import { PageHeader } from '../components/domain';
import { Segmented } from '../components/Segmented';
import { Button, Field, TextArea, TextInput } from '../components/ui';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';

const s = stylex.create({
  page: { display: 'flex', flexDirection: 'column', gap: space.xl },
  grid: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1fr) minmax(0, 1fr)', '@media (max-width: 900px)': 'minmax(0, 1fr)' },
    gap: space.xl,
    alignItems: 'start',
  },
  col: { display: 'flex', flexDirection: 'column', gap: space.xl, minWidth: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: space.lg },
  two: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1fr) minmax(0, 1fr)', '@media (max-width: 480px)': 'minmax(0, 1fr)' },
    gap: space.md,
  },
  storage: { display: 'flex', gap: space.md, alignItems: 'flex-start' },
  storageIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: radius.sm,
    backgroundColor: color.accentSoft,
    color: color.accent,
  },
  storageWarn: { backgroundColor: color.warnSoft, color: color.warn },
  storageText: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: text.ui, color: color.inkMuted },
  storageTitle: { fontWeight: 650, color: color.ink, fontSize: text.body },
  counts: { display: 'flex', flexWrap: 'wrap', gap: space.lg, fontFamily: font.mono, fontSize: text.small, color: color.inkMuted, marginTop: space.sm },
  row: { display: 'flex', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  body: { fontSize: text.ui, color: color.inkMuted, lineHeight: 1.6 },
  steps: { margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: text.ui, color: color.inkMuted, lineHeight: 1.55 },
  code: { fontFamily: font.mono, fontSize: text.small, backgroundColor: color.sunken, paddingInline: 4, borderRadius: 3, color: color.ink },
  file: { fontSize: text.small },
  paste: { fontFamily: font.mono, fontSize: text.small },
  preview: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.sunken,
    fontSize: text.ui,
    color: color.ink,
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
  },
  danger: { borderColor: color.redlineSoft },
  dangerText: { fontSize: text.ui, color: color.inkMuted },
  hidden: { display: 'none' },
});

function useDebouncedSettings() {
  const { actions } = useStore();
  return (body: Partial<Settings>) => void actions.saveSettings(body);
}

export function SettingsView() {
  const { data, meta, actions } = useStore();
  const toast = useToast();
  const save = useDebouncedSettings();
  const { pref, setPref } = useThemePref();
  const st = data.settings;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [paste, setPaste] = useState('');
  const [pending, setPending] = useState<ExportFile | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [importing, setImporting] = useState(false);
  const [erase, setErase] = useState('');
  const ro = meta.readOnly;

  const counts = {
    goals: Object.keys(data.goals).length,
    projects: Object.keys(data.projects).length,
    updates: Object.keys(data.updates).length,
    notes: Object.keys(data.notes).length,
  };

  const exportJson = () => JSON.stringify(actions.exportData(), null, 2);
  const filename = `workfile-${todayISO()}.json`;

  const download = async () => {
    const json = exportJson();
    if (inClaudeArtifact()) {
      const downloads = await getCapability('downloads');
      if (!downloads) {
        toast({ message: 'Downloads are unavailable here. Use Copy JSON instead.', tone: 'error' });
        return;
      }
      try {
        await downloads.save({ filename, data: json });
        toast({ message: `Saved ${filename}`, tone: 'good', icon: 'download' });
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code !== 'declined') toast({ message: 'Download failed. Use Copy JSON instead.', tone: 'error' });
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ message: `Saved ${filename}`, tone: 'good', icon: 'download' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson());
      toast({ message: 'Export copied. Paste it into a .json file to keep it.', tone: 'good', icon: 'copy' });
    } catch {
      setPaste(exportJson());
      toast({ message: 'Copy is blocked here. The export is in the box below; select it and copy.', tone: 'error' });
    }
  };

  const parse = (raw: string) => {
    try {
      const file = validateExport(JSON.parse(raw));
      if (!file) throw new Error('shape');
      setPending(file);
    } catch {
      setPending(null);
      toast({ message: "That isn't a Workfile export. Check you picked the right .json file.", tone: 'error' });
    }
  };

  const runImport = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      const n = await actions.importData(pending, mode);
      toast({ message: `Imported ${n.goals} goals, ${n.projects} projects, ${n.updates} updates and ${n.notes} notes`, tone: 'good' });
      setPending(null);
      setPaste('');
    } catch {
      toast({ message: 'Import stopped partway. Run it again; existing items are overwritten, not duplicated.', tone: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const field = (key: keyof Settings, label: string, opts: { type?: string; placeholder?: string } = {}) => (
    <Field label={label} htmlFor={`set-${key}`}>
      <TextInput
        id={`set-${key}`}
        type={opts.type ?? 'text'}
        key={`${key}-${String(st[key])}`}
        defaultValue={String(st[key])}
        placeholder={opts.placeholder}
        readOnly={ro}
        onBlur={(e) => {
          const v = opts.type === 'number' ? Number(e.target.value) : e.target.value;
          if (v !== st[key]) save({ [key]: v } as Partial<Settings>);
        }}
      />
    </Field>
  );

  return (
    <div {...stylex.props(s.page)}>
      <PageHeader title="Settings & data" sub="Your profile, the review cycle, and where your data lives." />

      <div {...stylex.props(s.grid)}>
        <div {...stylex.props(s.col)}>
          <Frame tag="Profile">
            <div {...stylex.props(s.form)}>
              {field('ownerName', 'Your name')}
              <div {...stylex.props(s.two)}>
                {field('role', 'Role')}
                {field('company', 'Company')}
              </div>
            </div>
          </Frame>

          <Frame tag="Review cycle" tagMeta="Drives pace markers and the cycle ruler">
            <div {...stylex.props(s.form)}>
              {field('cycleLabel', 'Name', { placeholder: 'FY 2026–27' })}
              <div {...stylex.props(s.two)}>
                {field('cycleStart', 'Starts', { type: 'date' })}
                {field('cycleEnd', 'Ends', { type: 'date' })}
              </div>
              {field('staleAfterDays', 'Flag a project after this many quiet days', { type: 'number' })}
            </div>
          </Frame>

          <Frame tag="Appearance">
            <Segmented<ThemePref>
              ariaLabel="Theme"
              value={pref}
              onChange={setPref}
              options={[
                { value: 'system', label: 'Match system', icon: 'monitor' },
                { value: 'light', label: 'Light', icon: 'sun' },
                { value: 'dark', label: 'Dark', icon: 'moon' },
              ]}
            />
          </Frame>
        </div>

        <div {...stylex.props(s.col)}>
          <Frame tag="Storage">
            <div {...stylex.props(s.storage)}>
              <span {...stylex.props(s.storageIcon, meta.backend === 'browser' && s.storageWarn)}>
                <Icon name={meta.backend === 'claude' ? 'cloud' : 'laptop'} size={18} />
              </span>
              <div {...stylex.props(s.storageText)}>
                <span {...stylex.props(s.storageTitle)}>
                  {meta.backend === 'claude'
                    ? 'Saved in this artifact’s database on Claude'
                    : meta.fallback
                      ? 'Saved in this browser only'
                      : 'Saved in this browser (local mode)'}
                </span>
                <span>
                  {meta.backend === 'claude'
                    ? 'Changes sync live across your devices wherever you open this artifact. Claude can also read and update your projects when you ask it to in chat.'
                    : meta.fallback
                      ? 'Claude storage is unavailable in this view. Export a backup and import it once you open Workfile in Claude again.'
                      : 'You are running Workfile on your own machine. Publish it as a Claude artifact to sync across devices, and export to move data between copies.'}
                </span>
                <span {...stylex.props(s.counts)}>
                  <span>{counts.goals} goals</span>
                  <span>{counts.projects} projects</span>
                  <span>{counts.updates} updates</span>
                  <span>{counts.notes} notes</span>
                </span>
              </div>
            </div>
          </Frame>

          <Frame tag="Back up & move">
            <div {...stylex.props(s.form)}>
              <p {...stylex.props(s.body)}>
                An export is one JSON file with everything: goals, projects, updates, notes and settings. Use it as a backup, or to move
                Workfile to your company’s Claude account.
              </p>
              <div {...stylex.props(s.row)}>
                <Button variant="primary" icon="download" onClick={download}>
                  Export JSON
                </Button>
                <Button variant="secondary" icon="copy" onClick={copy}>
                  Copy JSON
                </Button>
              </div>

              <Field label="Import" hint="Pick an export file, or paste its contents.">
                <div {...stylex.props(s.row)}>
                  <Button variant="secondary" icon="upload" disabled={ro} onClick={() => fileRef.current?.click()}>
                    Choose file
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    {...stylex.props(s.hidden)}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) parse(await f.text());
                      e.target.value = '';
                    }}
                  />
                </div>
              </Field>
              <TextArea
                aria-label="Paste export JSON"
                placeholder='{"app": "workfile", …}'
                value={paste}
                readOnly={ro}
                minRows={2}
                onChange={(e) => setPaste(e.target.value)}
                xstyle={s.paste}
              />
              {paste.trim() && !pending && (
                <div {...stylex.props(s.row)}>
                  <Button variant="secondary" onClick={() => parse(paste)}>
                    Check pasted JSON
                  </Button>
                </div>
              )}
              {pending && (
                <div {...stylex.props(s.preview)}>
                  <strong>
                    Ready to import {pending.goals.length} goals, {pending.projects.length} projects, {pending.updates.length} updates and{' '}
                    {pending.notes.length} notes
                  </strong>
                  <span {...stylex.props(s.body)}>Exported {pending.exportedAt.slice(0, 10)}.</span>
                  <Segmented
                    ariaLabel="Import mode"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'merge', label: 'Merge with current data' },
                      { value: 'replace', label: 'Replace everything' },
                    ]}
                  />
                  <div {...stylex.props(s.row)}>
                    <Button variant="ghost" onClick={() => setPending(null)}>
                      Cancel
                    </Button>
                    <Button variant={mode === 'replace' ? 'danger' : 'primary'} disabled={importing} onClick={runImport}>
                      {importing ? 'Importing…' : mode === 'replace' ? 'Replace and import' : 'Import'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Frame>

          <Frame tag="Moving to your company account">
            <ol {...stylex.props(s.steps)}>
              <li>
                Here, choose <strong>Export JSON</strong>.
              </li>
              <li>
                In your company Claude, clone the repo and run <code {...stylex.props(s.code)}>npm install</code> then{' '}
                <code {...stylex.props(s.code)}>npm run build:artifact</code>.
              </li>
              <li>Ask Claude to publish the built page as an artifact (the steps are in the repo’s README).</li>
              <li>
                Open the new artifact, go to Settings &amp; data, and import the file with <strong>Replace everything</strong>.
              </li>
            </ol>
          </Frame>

          <Frame tag="Danger zone" xstyle={s.danger}>
            <div {...stylex.props(s.form)}>
              <p {...stylex.props(s.dangerText)}>
                Erase every goal, project, update and note in this Workfile. Export first if you might want them back. Type{' '}
                <strong>erase</strong> to confirm.
              </p>
              <div {...stylex.props(s.row)}>
                <TextInput compact aria-label="Type erase to confirm" value={erase} onChange={(e) => setErase(e.target.value)} placeholder="erase" />
                <Button
                  variant="danger"
                  icon="trash"
                  disabled={erase.trim().toLowerCase() !== 'erase' || ro}
                  onClick={async () => {
                    await actions.eraseAll();
                    setErase('');
                    toast({ message: 'Everything was erased', icon: 'trash' });
                  }}
                >
                  Erase all data
                </Button>
              </div>
            </div>
          </Frame>
        </div>
      </div>
    </div>
  );
}
