import { FILES, STORAGE_KEY, validateContent, allItems, freshState, validateState, countCharacters, grade } from './core.js';

const main = document.querySelector('main');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = { university:'大学・学科研究', radiology:'診療放射線技師の基礎', worksheet:'志望理由を整理する', interview:'面接対策', guide:'小論文の書き方', essays:'小論文演習', academic:'基礎学力', quiz:'確認クイズ' };
const descriptions = { university:'学ぶ場所と、学科の特色を知る。', radiology:'医療を支える仕事への理解を深める。', worksheet:'学びたい理由を、自分の経験とつなげる。', interview:'自分の言葉で伝える練習をする。', guide:'主張と根拠を、伝わる文章に。', essays:'構成を考え、書いて、振り返る。', academic:'英語・国語・数学Ⅰの基本を確認。', quiz:'学んだことを4択で確かめる。' };
const sourceNames = { official:'大学公式情報', reference:'参考情報', general_education:'一般学習', original_exercise:'独自の練習問題', university_official_summary:'大学公式情報の要約' };
const sourceLinks = [ ['学科紹介','https://narita.iuhw.ac.jp/gakubu/rt/'], ['学校推薦型選抜','https://admissions.iuhw.ac.jp/exam/recommend/index.html'], ['受験Q&A','https://admissions.iuhw.ac.jp/qa/'], ['カリキュラム','https://narita.iuhw.ac.jp/gakubu/rt/curriculum.html'], ['アドミッション・ポリシー','https://narita.iuhw.ac.jp/about/policy/index.html'] ];
let data, items, byId, state = freshState(), storageBlocked = false;
let selected = null, revealed = false, activeId = null;
let pendingImport = null;
let editorialReviews = [];
const timers = new Map();
const link = (href, label, cls = '') => `<a class="${cls}" href="${esc(href)}">${esc(label)}</a>`;
const external = (url, label) => `<a class="external" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗<span class="sr-only">（新しいタブ）</span></a>`;
const button = (action, label, cls = '', extra = '') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${esc(label)}</button>`;
const list = values => `<ul>${values.map(v => `<li>${esc(v)}</li>`).join('')}</ul>`;
const details = (title, html) => `<details><summary>${esc(title)}</summary><div class="details-body">${html}</div></details>`;
const route = () => location.hash.slice(1).split('/');
const chapterItems = key => items.filter(i => i.chapter === key);
function notify(text) { document.querySelector('#message').textContent = text; }
function warn(text) { const el = document.querySelector('#storage-warning'); el.hidden = false; el.replaceChildren(document.createTextNode(text + ' ')); const a = document.createElement('a'); a.href = '#records'; a.textContent = '記録からバックアップ'; el.append(a); }
function persist() {
  if (storageBlocked) { notify('この画面内に保持しました。バックアップしてください。'); return false; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { warn('端末への保存に失敗しました。容量やブラウザ設定を確認してください。入力はこの画面内に保持しています。閉じる前にJSONで退避してください。'); return false; }
}
function toggle(array, value) { const idx = array.indexOf(value); idx < 0 ? array.push(value) : array.splice(idx, 1); }
function progress(key) {
  const entries = key === 'worksheet' ? [{id:'WORKSHEET'}] : key === 'guide' ? [{id:'GUIDE'}] : chapterItems(key);
  return [entries.filter(i => state.completedIds.includes(i.id)).length, entries.length];
}
const meter = (done,total) => `<div class="progress-text"><span>学習済み ${done} / ${total}</span><span>${Math.round(done / total * 100)}%</span></div><progress value="${done}" max="${total}" aria-label="学習済み ${done} / ${total}"></progress>`;
function heading(kicker,title,description='') { return `<div class="page-heading"><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1>${description ? `<p class="muted">${esc(description)}</p>` : ''}</div>`; }
function back(href='#learn', text='章一覧に戻る') { return link(href, '← ' + text, 'back'); }
function examNotice() {
  if (state.examType === 'public') return `<aside class="notice"><strong>公募制の情報 · 2027年度</strong><p>試験：2026年11月14日。基礎学力（英語・国語・数学Ⅰまで）90分・100点、小論文600字以内・60分、個人面接約10分。</p><p>出願登録：10月26日から。郵送：11月1〜6日（消印有効）。本人の出願資料・最新の募集要項で必ず再確認してください。</p>${external(sourceLinks[1][1], '大学公式の選抜情報')} ${link('#settings','方式を変更')}</aside>`;
  return `<aside class="notice"><div class="notice-title"><span aria-hidden="true">!</span><strong>${state.examType === 'unknown' ? '入試方式未確認' : '指定校制：高校で詳細を確認'}</strong></div><p>${state.examType === 'unknown' ? '公募制か指定校制か、高校進路指導室で確認しましょう。試験科目や時間は、方式によって異なります。' : '試験科目・時間・会場は高校進路指導室と本人宛ての案内で確認してください。公募制の条件から推測しません。'}</p>${link('#settings','推薦方式を確認・設定 →')}</aside>`;
}
function cards(keys) { return `<div class="chapter-grid">${keys.map((key) => { const [done,total] = progress(key); return `<a class="chapter-card" href="#${FILES[key] ? 'chapter/' : ''}${key}"><span class="chapter-number">${String(Object.keys(names).indexOf(key)+1).padStart(2,'0')}<span>${total}${['university','radiology'].includes(key)?'トピック':key==='worksheet'||key==='guide'?'ワーク':'問・題'}</span></span><h2>${names[key]}</h2><p>${descriptions[key]}</p>${meter(done,total)}<span class="card-arrow" aria-hidden="true">↗</span></a>`; }).join('')}</div>`; }
function home() {
  const done = items.filter(i => state.completedIds.includes(i.id)).length;
  const next = items.find(i => !state.completedIds.includes(i.id)) || items[0];
  return `<section class="hero"><p class="eyebrow">YOUR NEXT STEP / 2027</p><h1>知る。考える。<br>自分の言葉にする。</h1><p>国際医療福祉大学 成田保健医療学部<br>放射線・情報科学科への学びを、一歩ずつ。</p><div class="hero-bottom">${link('#item/'+next.id, done ? '学習を続ける →' : '大学研究からはじめる →','primary')}<span>今日の一歩を、ここから。</span></div><div class="hero-orbit" aria-hidden="true"><i></i><i></i><i></i><b>学びを<br>未来へ。</b></div></section>${examNotice()}<section class="stats" aria-label="学習状況"><div><strong>${done}<small> / ${items.length}</small></strong><span>教材の学習済み</span></div><div><strong>${state.mistakes.length}</strong><span>もう一度解く問題</span></div><div><strong>${state.bookmarks.length}</strong><span>ブックマーク</span></div></section><div class="section-title"><h2>今日の学習</h2>${link('#learn','すべての章を見る →')}</div>${cards(['university','interview','essays'])}<p class="privacy-note">回答と進捗は、このブラウザだけに保存されます。機器間の同期はありません。</p>`;
}
function searchSection() { return `<form id="search-form" class="search"><label for="query">教材を検索</label><div class="row"><input id="query" name="query" type="search" placeholder="例：MRI、チーム医療" autocomplete="off"><button class="primary">検索</button></div></form><div id="search-results"></div>`; }
function chapter(key) {
  if (!FILES[key]) return notFound();
  const rows = chapterItems(key);
  const info = key === 'academic' ? `<p class="notice">公募制向け想定の練習です。${state.examType === 'public' ? '実際の出題を保証しません。' : '任意学習として利用してください。本人の試験科目は学校の案内で確認してください。'}</p>` : '';
  return back() + heading('CHAPTER '+String(Object.keys(names).indexOf(key)+1).padStart(2,'0'), names[key], descriptions[key]) + info + (data[key].note ? `<p class="muted">${esc(data[key].note)}</p>` : '') + (key === 'essays' ? `<p class="notice">参考原稿12本は「参考構成例（要編集）」です。各設問専用の完成した模範解答ではありません。大学の出題予告ではありません。</p>` : '') + meter(...progress(key)) + (key === 'academic' ? `<label for="subject">科目を絞り込む</label><select id="subject"><option value="">すべて（60問）</option>${['英語','国語','数学Ⅰ'].map(s=>`<option>${s}</option>`).join('')}</select>` : '') + `<div id="item-list" class="item-list">${rows.map(itemRow).join('')}</div>`;
}
function itemRow(item) { return `<a class="item-row" href="#item/${item.id}"><span class="item-id">${item.id}</span><span><strong>${esc(item.title || item.question || item.prompt)}</strong><small>${esc(item.subject || item.category || sourceNames[item.sourceType] || '')}${item.reviewRequired ? ' · 要確認' : ''}${item.status ? ' · 参考構成例（要編集）' : ''}</small></span><span class="item-status">${state.completedIds.includes(item.id) ? '✓ 学習済み' : '→'}${state.bookmarks.includes(item.id) ? ' ★' : ''}</span></a>`; }
function controls(id, graded = false) { return `<div class="actions">${!graded ? button('complete',state.completedIds.includes(id)?'✓ 学習済みを解除':'学習済みにする','primary',`aria-pressed="${state.completedIds.includes(id)}"`) : ''}${button('bookmark',state.bookmarks.includes(id)?'★ 登録済み':'☆ ブックマーク','',`aria-pressed="${state.bookmarks.includes(id)}"`)}</div>`; }
function noteInput(id, label) { return `<label for="answer">${label}</label><textarea id="answer" data-note="${id}" rows="${id.startsWith('ESS')?12:7}" placeholder="自分の言葉で記入してください。">${esc(state.answers[id] || '')}</textarea><div class="row spread">${button('save-note','メモを保存','primary')}<span id="save-status" role="status">入力内容は自動保存されます</span></div>`; }
function essayBody(item) {
  const approval = editorialReviews.find(r => r.id === item.id);
  const approvedReference = approval ? `<section class="panel"><h2>編集者確認済みの参考文</h2><p>原本とは別に編集・確認された参考文です。本人の解答ではありません。</p>${details('編集者確認済みの参考文を開く', `<p class="prose">${esc(approval.revisedText)}</p><p>編集記録：${esc(approval.reviewNote)}</p><p>承認日：${esc(approval.approvedAt.slice(0,10))}</p>`)}</section>` : '';
  return `<p class="notice">独自の練習課題です。過去問・大学の出題予告ではありません。600字・60分は公募制想定の練習目安です。</p>${details('構成ヒントを開く',list(item.outline) + `<p>考えるキーワード：${esc(item.thinkingKeywords.join(' ／ '))}</p>`)}<section class="writing">${noteInput(item.id,'自分の小論文')}<p id="character-count" role="status" aria-live="polite"></p><p class="muted">改行・空白を含むUnicodeコードポイント単位。原稿用紙の厳密な字数とは異なります。</p></section><section class="timer-panel"><div><strong>練習タイマー（任意）</strong><p>${state.examType === 'public'?'公募制想定':state.examType === 'unknown'?'公募制想定・方式未確認':'公募制想定の任意練習・指定校制の条件ではありません'}</p></div><output id="timer-display" aria-label="残り時間">60:00</output><div class="actions">${button('timer-start','開始')}${button('timer-stop','停止')}${button('timer-reset','リセット')}</div><p id="timer-status" role="status"></p></section><section class="review-note"><h2>参考構成例（要編集）</h2><p>初稿・テンプレート的な共通例です。各設問専用の完成した模範解答ではありません。テーマ別の事実・具体例を付加し、編集者の承認が必要です。</p><p>${esc(data.essays.editorialNotice)}</p>${item.sampleAnswer !== null ? details('参考構成例（要編集）を開く',`<p class="prose">${esc(item.sampleAnswer)}</p><p>${esc(item.disclaimer)}</p><p class="muted">原稿：${countCharacters(item.sampleAnswer)}字（改行込み）／教材記載：${item.sampleLength}字</p>`) : ''}</section>${approvedReference}<h2>書いた後のチェック</h2><div class="checklist">${item.evaluationChecklist.map((text,i)=>`<label><input type="checkbox" data-check="${i}" ${state.checks[item.id]?.includes(i)?'checked':''}>${esc(text)}</label>`).join('')}</div>`;
}
function quizBody(item) {
  const correct = selected === item.correctIndex;
  return `<p class="muted">独自の練習問題です。過去問ではありません。</p><fieldset class="choices" ${revealed?'disabled':''}><legend>答えを1つ選んでください</legend>${item.choices.map((choice,i)=>`<label class="choice ${revealed && i===item.correctIndex?'correct':''}"><input type="radio" name="choice" value="${i}" ${selected===i?'checked':''}><span><b>${String.fromCharCode(65+i)}</b> ${esc(choice)}${revealed&&i===item.correctIndex?' <strong>（正解）</strong>':''}${revealed&&selected===i?' <strong>（あなたの選択）</strong>':''}</span></label>`).join('')}</fieldset>${!revealed ? button('grade','解答を確認する','primary',selected===null?'disabled':'') : `<section id="feedback" class="feedback ${correct?'good':'wrong'}" tabindex="-1" role="status"><h2>${correct?'✓ 正解':'× 不正解'}</h2><p>正解：${String.fromCharCode(65+item.correctIndex)} ${esc(item.choices[item.correctIndex])}</p><p>${esc(item.explanation)}</p></section>${button('retry','この問題に再挑戦')}`}<p class="muted">最新の結果を記録します。再挑戦で正解すると復習一覧から外れます。</p>`;
}
function itemPage(id) {
  const item = byId.get(id); if (!item) return notFound();
  const rows = chapterItems(item.chapter), idx = rows.findIndex(i=>i.id===id);
  const source = item.sourceUrl || (item.sourceType==='university_official_summary' ? data.university.topics.find(t=>t.body===item.explanation)?.sourceUrl : null);
  let body = '';
  if (item.body) body = `<p class="article-body">${esc(item.body)}</p><div class="learning-point"><span>学びのポイント</span><p>${esc(item.learningPoint)}</p></div>`;
  if (item.chapter === 'interview') body = `<p class="muted">${esc(data.interview.note)}</p>${details('回答ポイントを開く',list(item.answerPoints))}${item.sampleAnswer!==null?details('参考文を開く',`<p class="prose">${esc(item.sampleAnswer)}</p>`):''}${noteInput(id,'本人の回答メモ')}`;
  if (item.chapter === 'essays') body = essayBody(item);
  if (item.choices) body = quizBody(item);
  return back('#chapter/'+item.chapter,names[item.chapter]+'の一覧へ') + `<div class="detail-meta"><span class="tag">${esc(sourceNames[item.sourceType] || '独自の練習問題')}</span><span>${id} · ${idx+1} / ${rows.length}</span></div>` + heading(item.subject || item.category || names[item.chapter], item.title || item.question || item.prompt) + (item.reviewRequired?'<p class="notice">要確認：最新の大学公式情報で内容を再確認してください。</p>':'') + (item.chapter==='radiology'?`<p class="muted">${esc(data.radiology.note)}</p>`:'') + body + (source?`<div class="source">${external(source,'出典を確認する')}<p>資料確認日：2026-10-26。掲載内容は変更される場合があります。最新情報は公式サイトで確認してください。</p></div>`:'') + controls(id,!!item.choices) + `<div class="pagination">${idx>0?link('#item/'+rows[idx-1].id,'← 前へ'): '<span></span>'}${idx<rows.length-1?link('#item/'+rows[idx+1].id,'次へ →'):link('#records','学習記録へ →')}</div>`;
}
function worksheet() { return back() + heading('CONNECT YOUR STORY','志望理由を整理する','大学の特色と、自分の経験・目標を結びつけましょう。') + `<section class="panel"><h2>1. 学びたい特色を選ぶ</h2>${data.university.topics.map(t=>link('#item/'+t.id,t.title,'text-link')).join('')}</section><section class="panel"><h2>2. 自分の経験を振り返る</h2><p>固定文面を本人の体験とみなさず、実際に経験したことだけを書いてください。</p>${['INT-001','INT-002','INT-003','INT-009'].map(id=>`<details><summary>${esc(byId.get(id).question)}</summary><p class="prose">${esc(state.answers[id] || '本人メモはまだありません。')}</p>${link('#item/'+id,'面接メモを編集 →')}</details>`).join('')}</section><section class="panel"><h2>3. 自分の言葉でつなげる</h2><p>きっかけ → 大学で学びたいこと → 将来像の順に整理しましょう。</p>${noteInput('WORKSHEET','志望理由ワークシート')}</section>${controls('WORKSHEET')}`; }
function guide() { return back() + heading('WRITE WITH REASONS','小論文の書き方','設問に答え、理由と具体例で自分の主張を支えましょう。') + `<div class="panel"><h2>基本の4段構成</h2><ol class="steps"><li><strong>序論</strong><p>設問に対する結論・問題提起</p></li><li><strong>本論1</strong><p>理由と具体例</p></li><li><strong>本論2</strong><p>別の視点・懸念点・対処</p></li><li><strong>結論</strong><p>主張を簡潔にまとめる</p></li></ol><h2>評価チェックリスト</h2>${list(data.essays.essays[0].evaluationChecklist)}<p class="notice">参考構成例は要編集の初稿です。テーマ専用の完成した模範解答ではありません。</p>${link('#chapter/essays','12題の演習へ →','primary')}</div>${controls('GUIDE')}`; }
function records() {
  const gradedItems = items.filter(i=>i.choices && state.results[i.id]!==undefined);
  const correct = gradedItems.filter(i=>state.results[i.id]===i.correctIndex).length;
  return heading('YOUR LEARNING LOG','学習の記録','積み重ねた学びと、もう一度取り組みたいこと。') + `<div class="panel"><h2>章別の進捗</h2>${Object.keys(names).map(key=>`<div class="record-progress">${link(FILES[key]?'#chapter/'+key:'#'+key,names[key])}${meter(...progress(key))}</div>`).join('')}<p>最新の採点結果：${correct} / ${gradedItems.length}問正解（全110問）</p><p class="muted">進捗は読了・練習済みの記録で、習熟度の判定ではありません。</p></div><section class="panel"><h2>間違えた問題 <span class="count">${state.mistakes.length}</span></h2>${state.mistakes.length?state.mistakes.map(id=>itemRow(byId.get(id))).join(''):'<p class="muted">復習する問題はまだありません。</p>'}</section><section class="panel"><h2>ブックマーク</h2>${state.bookmarks.length?state.bookmarks.map(id=>byId.has(id)?itemRow(byId.get(id)):link(id==='WORKSHEET'?'#worksheet':'#guide',id==='WORKSHEET'?names.worksheet:names.guide,'text-link')).join(''):'<p class="muted">あとで読みたい教材を登録できます。</p>'}</section><section class="panel"><h2>データのバックアップ</h2><p>進捗・本人メモ・解答履歴をJSONファイルに保存します。機器間同期はありません。ファイルには本人の回答が含まれます。</p>${button('export','JSONをダウンロード','primary')}<div class="import"><label for="import-file">バックアップを読み込む</label><input id="import-file" type="file" accept="application/json,.json"><p class="muted">読み込み後の内容を確認してから復元できます。現在の記録を置き換えます。</p><div id="import-preview"></div></div></section>`;
}
function settings() { return back('#home','ホームへ') + heading('SETTINGS & SOURCES','設定・出典') + `<section class="panel"><h2>推薦方式</h2><label for="exam-type">高校で確認した方式を選択</label><select id="exam-type">${[['unknown','不明（未確認）'],['public','公募制'],['designated','指定校制']].map(([v,t])=>`<option value="${v}" ${state.examType===v?'selected':''}>${t}</option>`).join('')}</select><p>受験票・学校の案内で科目、時間、会場を確認し、2027年度の最新募集要項・出願時の通知と照合してください。</p></section>${examNotice()}<section class="panel"><h2>資料と出典</h2><p>設計資料更新日・教材確認日：2026-10-26</p><p>大学公式情報／一般学習／独自の練習問題をタグで区別しています。本教材は大学の公式アプリではありません。問題は過去問・出題予告ではありません。</p>${sourceLinks.map(([label,url])=>`<p>${external(url,label)}</p>`).join('')}<p>医療の説明は一般的な学習用であり、個人の診療上の助言ではありません。</p></section><section class="panel"><h2>端末内のデータ</h2><p>本人回答をサーバーへ送信しません。保存先はこのブラウザのlocalStorageです。共有端末では利用後の扱いに注意してください。</p>${link('#records','バックアップを開く →')}<details class="danger-zone"><summary>学習データを全消去</summary><p>このアプリの進捗と本人メモを消去します。必要な記録は先にダウンロードしてください。</p><label class="check-label"><input id="confirm-delete" type="checkbox">このアプリの学習データを消去する</label>${button('delete','確認して全消去','danger-button','disabled')}</details></section>`; }
function notFound() { return heading('NOT FOUND','ページが見つかりません') + link('#home','ホームへ戻る','primary'); }
function render(focus = true) {
  if (!data) return;
  const [page = 'home', value] = route();
  activeId = page==='item'?value:page==='worksheet'?'WORKSHEET':page==='guide'?'GUIDE':null;
  let html;
  if (!page || page==='home') html=home();
  else if (page==='learn') html=heading('LEARNING CHAPTERS','学ぶ','知識を深めて、自分の考えを育てる。')+searchSection()+cards(Object.keys(names));
  else if (page==='practice') html=heading('PRACTICE','練習する','話す・書く・解く。今日の練習を選びましょう。')+cards(['interview','essays','academic','quiz']);
  else if (page==='chapter') html=chapter(value);
  else if (page==='item') html=itemPage(value);
  else if (page==='worksheet') html=worksheet();
  else if (page==='guide') html=guide();
  else if (page==='records') html=records();
  else if (page==='settings') html=settings();
  else html=notFound();
  main.innerHTML=html;
  const nav = ['home','learn','practice','records'].includes(page)?page:['settings'].includes(page)?'home':['worksheet','guide','chapter','item'].includes(page)?(['interview','essays','academic','quiz'].includes(byId.get(value)?.chapter || value)?'practice':'learn'):'home';
  document.querySelectorAll('[data-nav]').forEach(a=>{ if(a.dataset.nav===nav) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  document.title = `${main.querySelector('h1')?.textContent || 'ホーム'} | まなびノート`;
  updateCount(); updateTimer();
  if (focus) { main.focus({preventScroll:true}); window.scrollTo(0,0); }
}
function updateCount() {
  const el=document.querySelector('#character-count'); if(!el)return;
  const count=countCharacters(state.answers[activeId]||''), limit=byId.get(activeId).recommendedCharacters;
  el.textContent=`${count} / ${limit}字（目安）${count>limit?' — 目安を超えています':''}`;
  el.classList.toggle('over-limit',count>limit);
}
function getTimer() {
  const item=byId?.get(activeId); if(item?.chapter!=='essays') return null;
  if(!timers.has(activeId)) timers.set(activeId,{remaining:item.recommendedMinutes*60000,end:null});
  return timers.get(activeId);
}
function updateTimer() {
  for(const [id,t] of timers) if(t.end!==null && Date.now()>=t.end) { t.end=null; t.remaining=0; notify(`${id}：練習時間が終了しました。入力はそのまま続けられます。`); }
  const t=getTimer(), display=document.querySelector('#timer-display'); if(!t||!display)return;
  const seconds=Math.ceil((t.end===null?t.remaining:Math.max(0,t.end-Date.now()))/1000);
  display.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  document.querySelector('[data-action="timer-start"]').disabled=t.end!==null||seconds===0;
  document.querySelector('[data-action="timer-stop"]').disabled=t.end===null;
}
main.addEventListener('input', event=>{
  const el=event.target;
  if(el.dataset.note) { state.answers[el.dataset.note]=el.value; const saved=persist(); document.querySelector('#save-status').textContent=saved?'端末に保存しました':'この画面内に保持中・バックアップが必要です'; updateCount(); }
});
main.addEventListener('change', async event=>{
  const el=event.target;
  if(el.id==='exam-type') { state.examType=el.value; persist(); render(false); document.querySelector('#exam-type').focus(); notify('推薦方式を更新しました。'); }
  if(el.name==='choice') { selected=Number(el.value); document.querySelector('[data-action="grade"]').disabled=false; }
  if(el.id==='subject') document.querySelector('#item-list').innerHTML=chapterItems('academic').filter(i=>!el.value||i.subject===el.value).map(itemRow).join('');
  if(el.dataset.check!==undefined) { state.checks[activeId] ||= []; toggle(state.checks[activeId],Number(el.dataset.check)); persist(); }
  if(el.id==='confirm-delete') document.querySelector('[data-action="delete"]').disabled=!el.checked;
  if(el.id==='import-file') {
    pendingImport=null;
    const preview=document.querySelector('#import-preview');
    try {
      if(!el.files[0])return;
      if(el.files[0].size>8_000_000)throw new Error('ファイルが大きすぎます（上限8MB）。');
      const parsed=JSON.parse(await el.files[0].text());
      if(parsed.app!=='narita-study' || parsed.formatVersion!==1)throw new Error('このアプリのバックアップではありません。');
      pendingImport=validateState(parsed.state,items);
      preview.innerHTML=`<p>学習済み ${pendingImport.completedIds.length}件／本人メモ ${Object.keys(pendingImport.answers).length}件。現在の記録を置き換えます。</p>${button('import-confirm','この内容で復元する','primary')}${button('import-cancel','キャンセル')}`;
    } catch(error) { preview.textContent='読み込めませんでした。既存データは保持しています。 '+error.message; notify('インポートエラー。既存データは変更していません。'); }
  }
});
main.addEventListener('submit', event=>{
  if(event.target.id!=='search-form')return;
  event.preventDefault();
  const query=document.querySelector('#query').value.trim().toLocaleLowerCase();
  const hits=query?items.filter(i=>[i.id,i.title,i.question,i.prompt,i.body,i.category,i.subject,i.learningPoint].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)):[];
  document.querySelector('#search-results').innerHTML=`<p role="status">${query?`${hits.length}件が見つかりました`:'検索語を入力してください'}</p>${hits.map(itemRow).join('')}`;
});
main.addEventListener('click', event=>{
  const el=event.target.closest('[data-action]'); if(!el)return;
  const action=el.dataset.action, item=byId.get(activeId);
  if(action==='bookmark'||action==='complete') { toggle(state[action==='bookmark'?'bookmarks':'completedIds'],activeId); persist(); render(false); document.querySelector(`[data-action="${action}"]`).focus(); }
  if(action==='save-note') { const ok=persist(); notify(ok?'本人メモを保存しました。':'端末に保存できません。JSONでバックアップしてください。'); }
  if(action==='grade'&&selected!==null) { grade(state,item,selected); persist(); revealed=true; render(false); document.querySelector('#feedback').focus(); }
  if(action==='retry') { selected=null; revealed=false; render(false); document.querySelector('input[name="choice"]').focus(); }
  if(action.startsWith('timer-')) {
    const t=getTimer(); if(!t)return;
    if(action==='timer-start' && t.end===null && t.remaining>0)t.end=Date.now()+t.remaining;
    if(action==='timer-stop' && t.end!==null) {t.remaining=Math.max(0,t.end-Date.now());t.end=null;}
    if(action==='timer-reset') {t.remaining=item.recommendedMinutes*60000;t.end=null;}
    updateTimer(); document.querySelector('#timer-status').textContent=action==='timer-start'?'計測中です。ページ再読み込み時はリセットされます。':action==='timer-stop'?'停止しました。':'リセットしました。';
  }
  if(action==='export') {
    const blob=new Blob([JSON.stringify({app:'narita-study',formatVersion:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download='narita-study-backup.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000); notify('バックアップのダウンロードを開始しました。');
  }
  if(action==='import-cancel') {pendingImport=null;document.querySelector('#import-preview').replaceChildren();}
  if(action==='import-confirm'&&pendingImport) {
    // Commit only after complete validation, and only if persistent storage succeeds.
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(pendingImport)); state=pendingImport; pendingImport=null; storageBlocked=false; document.querySelector('#storage-warning').hidden=true; render(false); notify('バックアップから復元しました。'); }
    catch { notify('端末に保存できないため復元を中止しました。既存データは保持しています。'); }
  }
  if(action==='delete'&&document.querySelector('#confirm-delete')?.checked) {
    try {localStorage.removeItem(STORAGE_KEY);state=freshState();storageBlocked=false;timers.clear();pendingImport=null;document.querySelector('#storage-warning').hidden=true;render();notify('このアプリの学習データを全消去しました。');}
    catch {notify('消去できませんでした。ブラウザの保存設定を確認してください。');}
  }
});
window.addEventListener('hashchange',()=>{selected=null;revealed=false;pendingImport=null;notify('');render();});
setInterval(updateTimer,250);
async function init() {
  try {
    const entries=await Promise.all(Object.keys(FILES).map(async name=>{
      const response=await fetch(new URL(`./content/${name}.json`,import.meta.url));
      if(!response.ok)throw new Error(`${name}.jsonを取得できません（${response.status}）`);
      return [name,await response.json()];
    }));
    const loaded=validateContent(Object.fromEntries(entries));
    items=allItems(loaded);byId=new Map(items.map(i=>[i.id,i]));data=loaded;
    // Separate editorial approvals cannot be supplied through a learner backup.
    try {
      const response = await fetch(new URL('./editorial-reviews.json', import.meta.url));
      if (!response.ok) throw new Error('編集記録を取得できません');
      const manifest = await response.json();
      if (manifest.version !== 1 || !Array.isArray(manifest.reviews)) throw new Error('編集記録が不正です');
      const verified = [];
      for (const record of manifest.reviews) {
        const original = byId.get(record.id);
        if (original?.chapter !== 'essays' || record.status !== 'approved_reference' || record.factsChecked !== true || record.themeExamplesChecked !== true || typeof record.revisedText !== 'string' || !record.revisedText.trim() || record.revisedText === original.sampleAnswer || countCharacters(record.revisedText) > original.recommendedCharacters || typeof record.reviewNote !== 'string' || !record.reviewNote.trim() || typeof record.approvedAt !== 'string' || !Number.isFinite(Date.parse(record.approvedAt))) throw new Error('編集承認が不正です');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(original.sampleAnswer)))).map(b=>b.toString(16).padStart(2,'0')).join('');
        if (hash !== record.originalSha256 || verified.some(r => r.id === record.id)) throw new Error('編集承認の対象が一致しません');
        verified.push(record);
      }
      editorialReviews = verified;
    } catch { notify('編集承認記録を確認できないため、編集済み参考文は表示しません。原本は要編集のままです。'); }
    try {const raw=localStorage.getItem(STORAGE_KEY);if(raw!==null)state=validateState(JSON.parse(raw),items);}
    catch {storageBlocked=true;warn('保存済みデータを読み込めません。元の保存データを上書きせず、一時的な学習モードで開いています。設定で全消去するか、有効なバックアップを復元してください。');}
    render(false);
  } catch(error) {
    main.innerHTML=heading('LOAD ERROR','教材を読み込めませんでした')+`<p class="notice" role="alert">${esc(error.message)}。既存の学習データは変更していません。</p><p>HTTPで配信していること、contentフォルダの6ファイルがそろっていることを確認してください。</p><button onclick="location.reload()">再読み込み</button>`;
  }
}
init();
