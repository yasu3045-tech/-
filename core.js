export const FILES = { university: ['topics', 15, 'UNI'], radiology: ['topics', 15, 'RAD'], interview: ['questions', 25, 'INT'], essays: ['essays', 12, 'ESS'], quiz: ['questions', 50, 'QUI'], academic: ['questions', 60, 'ACA'] };
export const STORAGE_KEY = 'narita-study:v1';
export const countCharacters = value => Array.from(value).length;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const string = v => typeof v === 'string' && v.trim().length > 0;
const strings = v => Array.isArray(v) && v.length > 0 && v.every(string);
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
export function validateContent(data) {
  const ids = new Set();
  for (const [name, [key, count, prefix]] of Object.entries(FILES)) {
    const file = data[name];
    assert(object(file) && file.schemaVersion === '1.0', `${name}: schemaVersionが不正です`);
    assert(Array.isArray(file[key]) && file[key].length === count, `${name}: 件数が不正です`);
    if ('sourceUrl' in file) assert(https(file.sourceUrl), `${name}: 出典URLが不正です`);
    for (const item of file[key]) {
      assert(object(item) && new RegExp(`^${prefix}-\\d{3}$`).test(item.id) && !ids.has(item.id), `${name}: IDが不正・重複しています`);
      ids.add(item.id);
      const required = key === 'topics' ? ['title','body','learningPoint','sourceType'] : name === 'essays' ? ['category','prompt','status','disclaimer'] : name === 'interview' ? ['category','question'] : ['question','explanation','sourceType', name === 'academic' ? 'subject' : 'category'];
      required.forEach(field => assert(string(item[field]), `${item.id}: ${field}がありません`));
      if (name === 'university') assert(https(item.sourceUrl) && typeof item.reviewRequired === 'boolean', `${item.id}: 出典・確認状態が不正です`);
      if ('sourceUrl' in item) assert(https(item.sourceUrl), `${item.id}: httpsの出典が必要です`);
      if (name === 'interview') {
        assert(strings(item.answerPoints) && typeof item.personalAnswer === 'string', `${item.id}: 面接データが不正です`);
        assert(item.sampleAnswer === null || string(item.sampleAnswer), `${item.id}: 参考文が不正です`);
      }
      if (name === 'essays') {
        for (const field of ['outline','thinkingKeywords','evaluationChecklist']) assert(strings(item[field]), `${item.id}: ${field}が不正です`);
        assert(item.sampleAnswer === null || string(item.sampleAnswer), `${item.id}: 参考原稿が不正です`);
        assert(item.status === 'draft_needs_editorial_review', `${item.id}: 未対応の編集状態です`);
        assert(Number.isInteger(item.recommendedCharacters) && item.recommendedCharacters > 0 && Number.isInteger(item.recommendedMinutes) && item.recommendedMinutes > 0, `${item.id}: 目安が不正です`);
      }
      if (['quiz','academic'].includes(name)) {
        assert(strings(item.choices) && item.choices.length === 4 && new Set(item.choices).size === 4, `${item.id}: 4択が不正です`);
        assert(Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < 4, `${item.id}: 正解番号が不正です`);
      }
    }
  }
  for (const subject of ['英語','国語','数学Ⅰ']) assert(data.academic.questions.filter(q => q.subject === subject).length === 20, `${subject}: 件数が不正です`);
  return data;
}
export const allItems = data => Object.entries(FILES).flatMap(([name, [key]]) => data[name][key].map(item => ({ ...item, chapter: name })));
export const freshState = () => ({ version: 1, examType: 'unknown', completedIds: [], bookmarks: [], answers: {}, mistakes: [], results: {}, checks: {} });
export function validateState(value, items) {
  assert(object(value) && value.version === 1 && ['unknown','public','designated'].includes(value.examType), 'バックアップの形式・バージョンが不正です');
  const byId = new Map(items.map(i => [i.id, i]));
  const allowed = new Set([...byId.keys(), 'WORKSHEET', 'GUIDE']);
  const state = freshState();
  state.examType = value.examType;
  for (const field of ['completedIds','bookmarks','mistakes']) {
    assert(Array.isArray(value[field]) && value[field].every(id => allowed.has(id)) && new Set(value[field]).size === value[field].length, `${field}が不正です`);
    state[field] = [...value[field]];
  }
  for (const field of ['answers','results','checks']) assert(object(value[field]), `${field}が不正です`);
  for (const [id, answer] of Object.entries(value.answers)) {
    assert((id === 'WORKSHEET' || ['interview','essays'].includes(byId.get(id)?.chapter)) && typeof answer === 'string' && answer.length <= 200000, '本人メモが不正です');
    state.answers[id] = answer;
  }
  for (const [id, result] of Object.entries(value.results)) {
    assert(byId.get(id)?.choices && Number.isInteger(result) && result >= 0 && result <= 3, '解答履歴が不正です');
    state.results[id] = result;
  }
  assert(state.mistakes.every(id => byId.get(id)?.choices && state.results[id] !== undefined && state.results[id] !== byId.get(id).correctIndex), '復習履歴が不正です');
  for (const [id, checked] of Object.entries(value.checks)) {
    assert(byId.get(id)?.evaluationChecklist && Array.isArray(checked) && checked.every(n => Number.isInteger(n) && n >= 0 && n < byId.get(id).evaluationChecklist.length), 'チェック項目が不正です');
    state.checks[id] = [...new Set(checked)];
  }
  return state;
}
export function grade(state, item, index) {
  assert(item.choices && Number.isInteger(index) && index >= 0 && index < 4, '選択肢が不正です');
  state.results[item.id] = index;
  if (!state.completedIds.includes(item.id)) state.completedIds.push(item.id);
  state.mistakes = state.mistakes.filter(id => id !== item.id);
  if (index !== item.correctIndex) state.mistakes.push(item.id);
  return index === item.correctIndex;
}
