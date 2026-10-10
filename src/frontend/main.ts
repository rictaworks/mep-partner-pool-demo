import './style.css';
import { FIELDS, LICENSES, SERVICES, USES, WORK_TYPES, ORDER_TYPES, coversRegion, validatePartner, validateProject } from '../core';
import type { Assignment, Engagement, Field, MatchingResult, Partner, Project, ProjectState, Region, Experience } from '../core';
import { api, ApiError } from './client';
const app = document.querySelector<HTMLElement>('#app')!, status = document.querySelector<HTMLElement>('#status')!, errorBox = document.querySelector<HTMLElement>('#error')!;
let regions: readonly Region[] = [], generation = 0, controller = new AbortController(), busy = false, successPending = false;
const states: Record<ProjectState, string> = { registered: '登録済', candidates: '候補提示中', partial: '一部割当', assigned: '割当完了' };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (text !== undefined)
        element.textContent = text;
    if (className)
        element.className = className;
    return element;
}
function add(parent: HTMLElement, ...children: (Node | string)[]): void {
    parent.append(...children);
}
function link(text: string, href: string): HTMLAnchorElement {
    const a = node('a', text);
    a.href = href;
    return a;
}
function button(text: string, action: () => void, className = ''): HTMLButtonElement {
    const b = node('button', text, className);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
}
function heading(text: string): void {
    app.replaceChildren();
    const h = node('h2', text);
    h.tabIndex = -1;
    add(app, h);
    h.focus();
}
function regionName(code: string): string {
    return regions.find(r => r.code === code)?.name ?? code;
}
function lock(): void {
    for (const b of app.querySelectorAll<HTMLButtonElement>('button'))
        if (busy && !b.disabled) {
            b.dataset.busyDisabled = 'true';
            b.disabled = true;
        }
        else if (!busy && b.dataset.busyDisabled) {
            b.disabled = false;
            delete b.dataset.busyDisabled;
        }
}
function showError(error: unknown): void {
    errorBox.replaceChildren();
    const message = error instanceof Error ? error.message : '処理できませんでした。再試行してください。';
    add(errorBox, node('p', message));
    if (error instanceof ApiError)
        for (const detail of error.details)
            add(errorBox, node('p', `${detail.path}: ${detail.message}`));
    add(errorBox, button('画面を再取得する', () => void route()));
}
async function mutate(action: () => Promise<unknown>, done: () => void, message = '保存しました。'): Promise<void> {
    if (busy)
        return;
    busy = true;
    const stamp = generation;
    status.textContent = '処理中です。';
    errorBox.replaceChildren();
    lock();
    try {
        await action();
        if (stamp === generation) {
            status.textContent = message;
            successPending = true;
            done();
        }
        else {
            status.textContent = '操作が完了しました。最新の情報を再取得します。';
            void route();
        }
    }
    catch (error) {
        if (stamp === generation) {
            status.textContent = '';
            showError(error);
        } else {
            status.textContent = '';
            showError(new ApiError('移動前の操作を完了できませんでした。元の画面を再取得して状態を確認してください。'));
        }
    }
    finally {
        busy = false;
        lock();
    }
}
function confirmInline(anchor: HTMLElement, message: string, action: () => void): void {
    if (anchor.querySelector('.confirm'))
        return;
    const box = node('div', undefined, 'confirm');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '操作の確認');
    add(box, node('p', message));
    const cancel = button('キャンセル', () => {
        box.remove();
        anchor.querySelector<HTMLElement>('button')?.focus();
    });
    add(box, node('div', undefined, 'actions'));
    const actions = box.lastElementChild as HTMLElement;
    add(actions, button('確定して実行する', () => {
        box.remove();
        action();
    }, 'danger'), cancel);
    box.addEventListener('keydown', event => {
        if (event.key === 'Escape')
            cancel.click();
    });
    add(anchor, box);
    cancel.focus();
}
function field(form: HTMLElement, label: string, name: string, type = 'text', value: string | number = '', required = true): HTMLInputElement {
    const wrapper = node('label', label), input = node('input');
    input.name = name;
    input.type = type;
    input.value = String(value);
    input.required = required;
    add(wrapper, input);
    add(form, wrapper);
    return input;
}
function select(form: HTMLElement, label: string, name: string, values: readonly string[], value: string, labels: (v: string) => string = v => v): HTMLSelectElement {
    const wrapper = node('label', label), s = node('select');
    s.name = name;
    s.setAttribute('aria-label', label);
    for (const v of values) {
        const option = node('option', labels(v));
        option.value = v;
        add(s, option);
    }
    s.value = value;
    add(wrapper, s);
    add(form, wrapper);
    return s;
}
function checks(form: HTMLElement, title: string, name: string, values: readonly string[], chosen: readonly string[]): void {
    const group = node('fieldset'), legend = node('legend', title), row = node('div', undefined, 'checks');
    add(group, legend, row);
    for (const value of values) {
        const label = node('label'), input = node('input');
        input.type = 'checkbox';
        input.name = name;
        input.value = value;
        input.checked = chosen.includes(value);
        add(label, input, value);
        add(row, label);
    }
    add(form, group);
}
function honeypot(form: HTMLElement): void {
    const box = node('div', undefined, 'honeypot');
    box.setAttribute('aria-hidden', 'true');
    const input = field(box, '入力しないでください', 'website', 'text', '', false);
    input.tabIndex = -1;
    input.autocomplete = 'off';
    add(form, box);
}
function formActions(form: HTMLFormElement, back: string): void {
    const actions = node('div', undefined, 'actions'), save = node('button', '保存する', 'primary');
    save.type = 'submit';
    add(actions, save, link('キャンセル', back));
    add(form, actions);
    honeypot(form);
}
function dataString(data: FormData, name: string): string {
    return String(data.get(name) ?? '');
}
function numbers(input: HTMLInputElement, min = 0, integer = true): void {
    input.min = String(min);
    input.step = integer ? '1' : 'any';
}
function validationErrors(result: {
    ok: boolean;
    errors?: readonly {
        path: string;
        message: string;
    }[];
}): void {
    if (!result.ok)
        throw new ApiError('入力内容を確認してください。', 'VALIDATION', result.errors);
}
async function partnersList(stamp: number): Promise<void> {
    const partners = await api<Partner[]>('/partners', 'GET', undefined, controller.signal);
    if (stamp !== generation)
        return;
    heading('事務所一覧');
    const toolbar = node('div', undefined, 'toolbar');
    add(toolbar, node('p', `${partners.length}件の架空事務所です。`), link('事務所を登録する', '#partners/new'));
    add(app, toolbar);
    const filters = node('div', undefined, 'filters');
    const f = select(filters, '分野で絞り込む', 'filterField', ['', ...FIELDS], '', v => v || 'すべて'), l = select(filters, '資格で絞り込む', 'filterLicense', ['', ...LICENSES], '', v => v || 'すべて'), r = select(filters, '地域で絞り込む', 'filterRegion', ['', ...regions.filter(r => !r.isWholePref).map(r => r.code)], '', v => v ? regionName(v) : 'すべて');
    const area = node('div');
    add(app, filters, area);
    function draw() {
        area.replaceChildren();
        const filtered = partners.filter(p => (!f.value || p.fields.includes(f.value as Field)) && (!l.value || p.licenses.includes(l.value as typeof LICENSES[number])) && (!r.value || coversRegion(p.regions, r.value)));
        if (!filtered.length) {
            add(area, node('p', '条件に合う事務所はありません。', 'empty'));
            return;
        }
        const table = node('table'), head = node('tr');
        for (const title of ['コード・略称', '分野・資格', '対応地域', '上限・受付', '操作'])
            add(head, node('th', title));
        add(table, head);
        for (const p of filtered) {
            const row = node('tr');
            add(row, node('td', `${p.code} / ${p.shortName}`), node('td', `${p.fields.join('・')} / ${p.licenses.join('・') || '資格なし'}`), node('td', p.regions.map(regionName).join('・') || '指定なし'), node('td', `${p.capacity}件 / ${p.active ? '受付中' : '受付停止'}`));
            const actions = node('td');
            add(actions, link('編集・稼働管理', `#partners/${p.id}`));
            add(row, actions);
            add(table, row);
        }
        const wrap = node('div', undefined, 'table-wrap');
        add(wrap, table);
        add(area, wrap);
    }
    for (const filter of [f, l, r])
        filter.addEventListener('change', draw);
    draw();
}
const zeroExperience = (): Experience => ({ '教育施設': { '新築': 0, '改修': 0 }, '公営住宅': { '新築': 0, '改修': 0 }, '公共施設': { '新築': 0, '改修': 0 } });
async function partnerEdit(id: number | undefined, stamp: number): Promise<void> {
    let partner: Partner | undefined, engagements: Engagement[] = [];
    if (id !== undefined) {
        partner = await api<Partner>(`/partners/${id}`, 'GET', undefined, controller.signal);
        engagements = await api<Engagement[]>(`/partners/${id}/engagements`, 'GET', undefined, controller.signal);
    }
    if (stamp !== generation)
        return;
    heading(id === undefined ? '事務所を登録する' : '事務所の編集・稼働管理');
    add(app, link('事務所一覧に戻る', '#partners'));
    const form = node('form'), grid = node('div', undefined, 'grid');
    add(form, grid);
    const code = field(grid, '事務所コード', 'code', 'text', partner?.code ?? '');
    code.maxLength = 32;
    code.pattern = '[A-Za-z0-9_\\-]+';
    const short = field(grid, '表示用略称', 'shortName', 'text', partner?.shortName ?? '');
    short.maxLength = 80;
    add(form, node('p', '略称には個人名を入力せず、架空の名称を使ってください。', 'muted'));
    checks(form, '対応分野（1つ以上）', 'fields', FIELDS, partner?.fields ?? []);
    checks(form, '保有資格', 'licenses', LICENSES, partner?.licenses ?? []);
    const exp = node('fieldset');
    add(exp, node('legend', '用途・種別ごとの実績件数'));
    const expGrid = node('div', undefined, 'grid');
    add(exp, expGrid);
    for (const use of USES)
        for (const work of WORK_TYPES)
            numbers(field(expGrid, `${use}・${work}`, `experience:${use}:${work}`, 'number', partner?.experience[use][work] ?? 0));
    add(form, exp);
    const regionsBox = node('fieldset');
    add(regionsBox, node('legend', '対応地域（全域または区市）'));
    const regionChecks = node('div', undefined, 'checks');
    for (const region of regions) {
        const label = node('label'), input = node('input');
        input.name = 'regions';
        input.type = 'checkbox';
        input.value = region.code;
        input.checked = partner?.regions.includes(region.code) ?? false;
        add(label, input, region.name);
        add(regionChecks, label);
    }
    add(regionsBox, regionChecks);
    add(form, regionsBox);
    checks(form, '対応できる業務', 'services', SERVICES, partner?.services ?? []);
    numbers(field(form, '同時引受上限', 'capacity', 'number', partner?.capacity ?? 1));
    checks(form, '受付状態', 'active', ['受付中'], partner?.active ?? true ? ['受付中'] : []);
    formActions(form, '#partners');
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity())
            return;
        const data = new FormData(form), experience = zeroExperience() as Record<typeof USES[number], Record<typeof WORK_TYPES[number], number>>;
        for (const use of USES)
            for (const work of WORK_TYPES)
                experience[use][work] = Number(data.get(`experience:${use}:${work}`));
        const input = { code: dataString(data, 'code'), shortName: dataString(data, 'shortName'), fields: data.getAll('fields'), licenses: data.getAll('licenses'), experience, regions: data.getAll('regions'), services: data.getAll('services'), capacity: Number(data.get('capacity')), active: data.has('active') };
        try {
            validationErrors(validatePartner(input));
        }
        catch (error) {
            showError(error);
            return;
        }
        void mutate(() => api(id === undefined ? '/partners' : `/partners/${id}`, id === undefined ? 'POST' : 'PUT', { ...input, website: dataString(data, 'website'), ...(partner ? { revision: partner.revision } : {}) }), () => {
            location.hash = '#partners';
        });
    });
    add(app, form);
    if (partner) {
        const actions = node('div', undefined, 'actions');
        add(actions, button('この事務所を削除する', () => confirmInline(actions, '事務所と手動稼働を削除します。割当中の場合は先に取消が必要です。', () => void mutate(() => api(`/partners/${id}`, 'DELETE', { website: '' }), () => {
            location.hash = '#partners';
        }, '削除しました。')), 'danger'));
        add(app, actions);
        headingSection('稼働期間');
        add(app, node('p', '割当中は事務所の編集・削除ができません。割当を先に取り消してください。', 'muted'));
        if (!engagements.length)
            add(app, node('p', '登録された稼働はありません。', 'empty'));
        for (const e of engagements) {
            const line = node('div', undefined, 'candidate');
            add(line, node('p', `${e.period.start} 〜 ${e.period.end} / ${e.assignmentId === null ? '手動稼働' : '割当による稼働'}`));
            if (e.assignmentId === null)
                add(line, button('手動稼働を取り消す', () => confirmInline(line, 'この手動稼働を取り消しますか。', () => void mutate(() => api(`/partners/${id}/engagements/${e.id}`, 'DELETE', { website: '' }), () => void route(), '稼働を取り消しました。'))));
            add(app, line);
        }
        const workload = node('form'), row = node('div', undefined, 'grid');
        field(row, '稼働開始日', 'start', 'date');
        field(row, '稼働終了日', 'end', 'date');
        add(workload, row);
        const submit = node('button', '手動稼働を登録する', 'primary');
        submit.type = 'submit';
        add(workload, submit);
        honeypot(workload);
        workload.addEventListener('submit', event => {
            event.preventDefault();
            if (!workload.reportValidity())
                return;
            const data = new FormData(workload);
            void mutate(() => api(`/partners/${id}/engagements`, 'POST', { period: { start: dataString(data, 'start'), end: dataString(data, 'end') }, website: dataString(data, 'website') }), () => void route(), '稼働を登録しました。');
        });
        add(app, workload);
    }
}
function headingSection(text: string): void {
    add(app, node('h3', text));
}
async function projectsList(stamp: number): Promise<void> {
    const projects = await api<Project[]>('/projects', 'GET', undefined, controller.signal);
    if (stamp !== generation)
        return;
    heading('案件一覧');
    add(app, link('案件を登録する', '#projects/new'));
    if (!projects.length) {
        add(app, node('p', '案件はまだありません。', 'empty'));
        return;
    }
    const table = node('table'), head = node('tr');
    for (const title of ['案件名', '条件', '期間', '割当状態', '操作'])
        add(head, node('th', title));
    add(table, head);
    for (const p of projects) {
        const row = node('tr'), actions = node('td');
        add(actions, link('詳細・候補', `#projects/${p.id}`));
        add(row, node('td', p.name), node('td', `${p.requiredFields.join('・')} / ${p.workType} / ${regionName(p.region)}`), node('td', `${p.period.start}〜${p.period.end}`), node('td', states[p.state]), actions);
        add(table, row);
    }
    const wrap = node('div', undefined, 'table-wrap');
    add(wrap, table);
    add(app, wrap);
}
async function projectEdit(id: number | undefined, stamp: number): Promise<void> {
    const project = id === undefined ? undefined : await api<Project>(`/projects/${id}`, 'GET', undefined, controller.signal);
    if (stamp !== generation)
        return;
    heading(id === undefined ? '案件を登録する' : '案件条件を変更する');
    add(app, link('案件一覧に戻る', '#projects'));
    const form = node('form'), grid = node('div', undefined, 'grid');
    const name = field(grid, '案件名', 'name', 'text', project?.name ?? '');
    name.maxLength = 120;
    select(grid, '業務種別', 'workType', WORK_TYPES, project?.workType ?? '新築');
    select(grid, '用途', 'use', USES, project?.use ?? '教育施設');
    select(grid, '案件の区市', 'region', regions.filter(r => !r.isWholePref).map(r => r.code), project?.region ?? '13101', regionName);
    numbers(field(grid, '階数', 'floors', 'number', project?.floors ?? 1), 1);
    numbers(field(grid, '延床面積（㎡）', 'floorArea', 'number', project?.floorArea ?? 1000), 0, false);
    field(grid, '業務開始日', 'start', 'date', project?.period.start ?? '');
    field(grid, '納期', 'end', 'date', project?.period.end ?? '');
    select(grid, '発注形態', 'orderType', ORDER_TYPES, project?.orderType ?? '入札');
    add(form, grid);
    checks(form, '必要分野（1つ以上）', 'requiredFields', FIELDS, project?.requiredFields ?? ['電気', '機械']);
    checks(form, '必要な対応業務', 'requiredServices', SERVICES, project?.requiredServices ?? []);
    checks(form, '実施体制', 'requireListedLicense', ['担当技術者の資格記載が必要'], project?.requireListedLicense ? ['担当技術者の資格記載が必要'] : []);
    add(form, node('p', '改修では「現地調査」が自動で必要になります。3階以上かつ5,000㎡超では仕様上の資格要件が適用されます。', 'muted'));
    formActions(form, id === undefined ? '#projects' : `#projects/${id}`);
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity())
            return;
        const data = new FormData(form), input = { name: dataString(data, 'name'), requiredFields: data.getAll('requiredFields'), workType: dataString(data, 'workType'), use: dataString(data, 'use'), region: dataString(data, 'region'), floors: Number(data.get('floors')), floorArea: Number(data.get('floorArea')), period: { start: dataString(data, 'start'), end: dataString(data, 'end') }, requiredServices: data.getAll('requiredServices'), orderType: dataString(data, 'orderType'), requireListedLicense: data.has('requireListedLicense') };
        try {
            validationErrors(validateProject(input));
        }
        catch (error) {
            showError(error);
            return;
        }
        void mutate(() => api<Project>(id === undefined ? '/projects' : `/projects/${id}`, id === undefined ? 'POST' : 'PUT', { ...input, website: dataString(data, 'website'), ...(project ? { revision: project.revision } : {}) }), () => {
            location.hash = '#projects';
        });
    });
    add(app, form);
}
type ProjectDetail = Project & {
    assignments: Assignment[];
};
type CandidateResult = MatchingResult & {
    projectRevision: number;
};
async function projectDetail(id: number, stamp: number): Promise<void> {
    let project = await api<ProjectDetail>(`/projects/${id}`, 'GET', undefined, controller.signal);
    let partners = await api<Partner[]>('/partners', 'GET', undefined, controller.signal);
    if (stamp !== generation)
        return;
    let matching: CandidateResult | undefined;
    function draw() {
        app.replaceChildren();
        heading('案件詳細・候補');
        add(app, link('案件一覧に戻る', '#projects'));
        const details = node('dl');
        const conditions: [
            string,
            string
        ][] = [['案件名', project.name], ['割当状態', states[project.state]], ['必要分野', project.requiredFields.join('・')], ['業務種別・用途', `${project.workType} / ${project.use}`], ['区市', regionName(project.region)], ['規模', `${project.floors}階 / ${project.floorArea}㎡`], ['期間', `${project.period.start}〜${project.period.end}`], ['必要業務', project.requiredServices.join('・') || '指定なし'], ['発注形態', project.orderType], ['担当資格の記載', project.requireListedLicense ? '必要です' : '不要です']];
        for (const [label, value] of conditions)
            add(details, node('dt', label), node('dd', value));
        add(app, details);
        const operations = node('div', undefined, 'actions');
        add(operations, link('案件条件を変更する', `#projects/${id}/edit`), button('案件を削除する', () => confirmInline(operations, '案件を削除します。割当中の場合は先に取消が必要です。', () => void mutate(() => api(`/projects/${id}`, 'DELETE', { website: '' }), () => {
            location.hash = '#projects';
        }, '案件を削除しました。')), 'danger'));
        add(app, operations);
        const active = project.assignments.filter(a => a.status === 'confirmed'), occupied = new Set(active.flatMap(a => a.fields));
        headingSection('確定した担当');
        if (!active.length)
            add(app, node('p', '割当はまだ確定していません。', 'empty'));
        for (const assignment of active) {
            const line = node('div', undefined, 'candidate'), office = partners.find(p => p.id === assignment.partnerId);
            add(line, node('p', `${assignment.fields.join('・')} / ${office?.code ?? '事務所'} / ${office?.shortName ?? ''}`));
            add(line, button('この割当を取り消す', () => confirmInline(line, 'この担当の割当を取り消しますか。手動稼働は残ります。', () => void mutate(async () => {
                const data = await api<{
                    project: Project;
                    assignments: Assignment[];
                }>(`/projects/${id}/assignments/${assignment.id}`, 'DELETE', { website: '', requestId: crypto.randomUUID() });
                project = { ...data.project, assignments: data.assignments };
                matching = undefined;
            }, draw, '割当を取り消しました。'))));
            add(app, line);
        }
        const extract = button('候補を抽出する', () => void mutate(async () => {
            const result = await api<CandidateResult>(`/projects/${id}/candidates`, 'POST', { website: '' });
            const fresh = await api<ProjectDetail>(`/projects/${id}`);
            const freshPartners = await api<Partner[]>('/partners');
            if (fresh.revision !== result.projectRevision) {
                matching = undefined;
                throw new ApiError('案件条件が変わりました。画面を再取得して候補を再抽出してください。', 'STALE_CANDIDATE');
            }
            project = fresh;
            partners = freshPartners;
            matching = result;
        }, draw, '候補を抽出しました。'), 'primary');
        add(app, node('div', undefined, 'actions'));
        add(app.lastElementChild as HTMLElement, extract);
        if (!matching) {
            add(app, node('p', project.state === 'partial' ? '一部割当です。候補を再抽出して残りの分野を確定してください。' : '候補を抽出すると、順位・根拠・除外理由を確認できます。', 'muted'));
            lock();
            return;
        }
        headingSection('自動適用した要件');
        const derived = node('ul');
        add(derived, node('li', matching.derived.statutoryLicense ? '法定資格要件：設備設計一級建築士の関与が必要です（仕様の簡略ルールです）。' : '法定資格要件：この規模では自動適用されません。'));
        if (Object.keys(matching.derived.listedLicenseByField).length)
            for (const field of project.requiredFields)
                add(derived, node('li', `実施体制資格・${field}：${matching.derived.listedLicenseByField[field]?.join('・') ?? '不要です'}`));
        else
            add(derived, node('li', '実施体制資格：担当資格の記載は不要です。'));
        add(derived, node('li', matching.derived.autoServices.length ? `改修補完：${matching.derived.autoServices.join('・')}を自動追加しました。` : '改修補完：自動追加はありません。'));
        add(derived, node('li', `判定する必要業務：${matching.derived.requiredServices.join('・') || '指定なし'}`));
        add(app, derived);
        headingSection(`候補順位（${matching.candidates.length}件）`);
        if (!matching.candidates.length) {
            add(app, node('p', '候補は0件です。', 'empty'));
            if (matching.relaxations.length) {
                headingSection('緩和の提案');
                add(app, node('p', '提案を表示するだけです。案件条件は自動で変更しません。'));
                const list = node('ul');
                for (const suggestion of matching.relaxations)
                    add(list, node('li', `${suggestion.relaxedRequirements.join('・')}を緩和すると${suggestion.candidateCount}件の候補が現れます。`));
                add(app, list);
            }
            if (matching.poolInsufficient)
                add(app, node('p', 'プールに該当資格・分野などの条件を満たす事務所が不足しています。事務所の追加や条件をご確認ください。'));
        }
        for (const candidate of matching.candidates) {
            const card = node('section', undefined, 'candidate');
            add(card, node('h3', `${candidate.rank}位 / ${candidate.kind === 'single' ? '単独' : '組'} / ${candidate.partnerCodes.join(' ＋ ')}`));
            add(card, node('p', `電気担当：${candidate.electrical ?? '不要です'} / 機械担当：${candidate.mechanical ?? '不要です'}`));
            add(card, node('p', `用途×種別実績 ${candidate.basis.exactExperience}件 / 用途合計 ${candidate.basis.useExperience}件 / 稼働余裕 ${candidate.basis.spareCapacity}件`));
            add(card, node('p', `抽出結果の資格：${candidate.basis.licenses.join('・') || 'なし'}`));
            for (const code of candidate.partnerCodes) {
                const office = partners.find(p => p.code === code);
                add(card, node('p', `${code}の取得時保有資格：${office?.licenses.join('・') || 'なし'}`));
            }
            if (matching.derived.statutoryLicense) {
                const qualified = candidate.partnerCodes.filter(code => partners.find(p => p.code === code)?.licenses.includes('設備設計一級建築士'));
                add(card, node('p', `法定資格の担当事務所：${qualified.join('・') || 'なし（再抽出してください）'}`));
            }
            for (const field of project.requiredFields) {
                const code = field === '電気' ? candidate.electrical : candidate.mechanical;
                const allowed = matching.derived.listedLicenseByField[field];
                const held = partners.find(p => p.code === code)?.licenses.filter(license => allowed?.includes(license)) ?? [];
                add(card, node('p', `${field}の実施体制担当：${code ?? '不要です'} / 許容資格：${allowed?.join('・') ?? '記載不要です'}${allowed ? ` / 満たす保有資格：${held.join('・') || 'なし（再抽出してください）'}` : ''}`));
            }
            for (const note of candidate.notes)
                add(card, node('p', note, 'badge'));
            const controls = node('div', undefined, 'actions');
            const confirmFields = (fields: readonly Field[]) => {
                const map = new Map<number, Field[]>();
                for (const field of fields) {
                    const code = field === '電気' ? candidate.electrical : candidate.mechanical, office = partners.find(p => p.code === code);
                    if (!office) {
                        showError(new ApiError('事務所が変わりました。候補を再抽出してください。'));
                        return;
                    }
                    map.set(office.id, [...(map.get(office.id) ?? []), field]);
                }
                const requestId = crypto.randomUUID();
                confirmInline(card, `${fields.join('・')}の担当をこの候補で確定しますか。最新条件で再判定します。`, () => void mutate(async () => {
                    const data = await api<{
                        project: Project;
                        assignments: Assignment[];
                    }>(`/projects/${id}/assignments`, 'POST', { website: '', requestId, projectRevision: matching!.projectRevision, selections: Array.from(map, ([partnerId, fields]) => ({ partnerId, fields })) });
                    project = { ...data.project, assignments: data.assignments };
                    matching = undefined;
                }, draw, '割当を確定しました。'));
            };
            const remaining = project.requiredFields.filter(f => !occupied.has(f));
            if (remaining.length)
                add(controls, button(occupied.size ? '残り分野を確定する' : '全分野を確定する', () => confirmFields(remaining), 'primary'));
            if (project.requiredFields.length === 2 && remaining.length === 2)
                for (const field of remaining)
                    add(controls, button(`${field}のみ確定する`, () => confirmFields([field])));
            add(card, controls);
            add(app, card);
        }
        const exclusions = node('details'), summary = node('summary', '全事務所の除外理由');
        add(exclusions, summary);
        const list = node('ul');
        for (const item of matching.exclusions)
            add(list, node('li', `${item.partnerCode}: ${item.failedRequirements.join('・') || '除外理由なし（候補を構成できます）'}`));
        add(exclusions, list);
        add(app, exclusions);
        lock();
    }
    draw();
}
async function route(): Promise<void> {
    controller.abort();
    controller = new AbortController();
    const stamp = ++generation;
    app.replaceChildren(node('p', '読み込み中です。'));
    app.setAttribute('aria-busy', 'true');
    errorBox.replaceChildren();
    if (!busy) {
        if (successPending)
            successPending = false;
        else
            status.textContent = '';
    }
    try {
        if (!regions.length)
            regions = await api<Region[]>('/regions', 'GET', undefined, controller.signal);
        if (stamp !== generation)
            return;
        const hash = location.hash.slice(1) || 'partners';
        if (hash === 'partners')
            await partnersList(stamp);
        else if (hash === 'partners/new')
            await partnerEdit(undefined, stamp);
        else if (/^partners\/[1-9]\d*$/u.test(hash))
            await partnerEdit(Number(hash.split('/')[1]), stamp);
        else if (hash === 'projects')
            await projectsList(stamp);
        else if (hash === 'projects/new')
            await projectEdit(undefined, stamp);
        else if (/^projects\/[1-9]\d*\/edit$/u.test(hash))
            await projectEdit(Number(hash.split('/')[1]), stamp);
        else if (/^projects\/[1-9]\d*$/u.test(hash))
            await projectDetail(Number(hash.split('/')[1]), stamp);
        else {
            app.replaceChildren();
            heading('画面が見つかりません');
            add(app, link('事務所一覧に戻る', '#partners'));
        }
    }
    catch (error) {
        if (stamp === generation && !(error instanceof DOMException && error.name === 'AbortError')) {
            app.replaceChildren(node('p', '表示できませんでした。', 'empty'));
            showError(error);
        }
    }
    finally {
        if (stamp === generation) {
            app.setAttribute('aria-busy', 'false');
            lock();
        }
    }
}
window.addEventListener('hashchange', () => void route());
void route();
