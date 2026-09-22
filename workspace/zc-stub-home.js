/**
 * home.html 专用鉴权桩。
 *
 * 与 zc-stub-pf.js 同构，字段严格对齐 sql/ 与 Java 实体契约：
 *   - /qa/mine 的字段是 question（不是 title）；references 是 List<LawArticle>，
 *     每项 { lawName, articleNo, title, content }（见 model/LawArticle.java）
 *   - /qa/mine 列表接口**确实会 fillReferences**（QaServiceImpl.myPage 第 155 行），
 *     所以展开详情不需要额外请求
 *   - /contracts/mine 的 riskLevel 是中文「高/中/低」
 *   - /doc-records/mine 的字段是 title / templateName
 *   - /knowledge 走分页信封，字段 title / summary / viewCount
 *   - /knowledge/:id 详情含 content / likeCount / favorited
 *   - /favorites 四种 targetType 的 total 用于首页指标卡聚合
 */
(function () {
  'use strict';

  var USER = {
    id: 2, username: 'zhangsan', nickname: '张三', role: 'USER',
    email: 'zhangsan@example.com', phone: '+86 138-0000-0001',
    city: '杭州', jobTitle: '人力资源专员',
    avatar: '',
    lastLoginAt: '2026-09-17T09:12:00',
    createdAt: '2026-01-05T09:12:00'
  };

  /* 法条样本：字段名与 model/LawArticle.java 完全一致 */
  var LAW_L40 = { id: 40, lawName: '中华人民共和国劳动合同法', articleNo: '第四十条',
    category: '劳动合同', title: '无过失性辞退',
    content: '有下列情形之一的，用人单位提前三十日以书面形式通知劳动者本人或者额外支付劳动者一个月工资后，可以解除劳动合同……',
    keywords: '辞退,预告解除', effectiveDate: '2013-07-01' };
  var LAW_L87 = { id: 87, lawName: '中华人民共和国劳动合同法', articleNo: '第八十七条',
    category: '劳动合同', title: '违法解除的赔偿金',
    content: '用人单位违反本法规定解除或者终止劳动合同的，应当依照本法第四十七条规定的经济补偿标准的二倍向劳动者支付赔偿金。',
    keywords: '违法解除,赔偿金', effectiveDate: '2013-07-01' };
  var LAW_L44 = { id: 44, lawName: '中华人民共和国劳动法', articleNo: '第四十四条',
    category: '工资福利', title: '加班工资标准',
    content: '安排劳动者延长工作时间的，支付不低于工资的百分之一百五十的工资报酬；休息日安排工作又不能安排补休的，支付不低于百分之二百的工资报酬。',
    keywords: '加班费', effectiveDate: '2018-12-29' };
  var LAW_L21 = { id: 21, lawName: '中华人民共和国劳动合同法', articleNo: '第二十一条',
    category: '劳动合同', title: '试用期解除限制',
    content: '在试用期中，除劳动者有本法第三十九条和第四十条第一项、第二项规定的情形外，用人单位不得解除劳动合同。',
    keywords: '试用期', effectiveDate: '2013-07-01' };
  var LAW_L45 = { id: 45, lawName: '职工带薪年休假条例', articleNo: '第五条',
    category: '休息休假', title: '未休年假工资',
    content: '单位确因工作需要不能安排职工休年休假的，经职工本人同意，可以不安排职工休年休假。对职工应休未休的年休假天数，单位应当按照该职工日工资收入的300%支付年休假工资报酬。',
    keywords: '年假,折现', effectiveDate: '2008-01-01' };

  var QA = [
    { id: 42, question: '昨天正常上班今天就让滚蛋，能要赔偿吗？',
      answer: '【初步结论】公司未提前通知即解除劳动关系，属于违法解除，你有权主张赔偿金。\n【法律依据】《劳动合同法》第四十条要求提前三十日书面通知或额外支付一个月工资；第八十七条规定违法解除应按经济补偿标准的二倍支付赔偿金。\n【建议步骤】1. 保留考勤记录与解除通知等证据；2. 向劳动监察大队投诉或申请劳动仲裁；3. 主张 2N 赔偿金。\n提示：劳动仲裁时效为一年，自知道权利被侵害之日起算。',
      category: '劳动合同', status: 1, likeCount: 6, references: [LAW_L40, LAW_L87],
      createdAt: '2026-09-16T15:20:00', createdAtText: '1天前' },
    { id: 41, question: '加班费的计算基数如何确定？',
      answer: '【初步结论】加班费基数一般按劳动合同约定的工资标准确定。\n【法律依据】《劳动法》第四十四条区分了延时、休息日、法定节假日三档加班工资标准。\n提示：约定不明时，通常以正常出勤月工资为准。',
      category: '工资福利', status: 1, likeCount: 3, references: [LAW_L44],
      createdAt: '2026-09-14T10:02:00', createdAtText: '3天前' },
    { id: 40, question: '试用期最长可以约定多久？',
      answer: '【初步结论】试用期上限与合同期限挂钩：三年以上或无固定期限最长六个月。\n【法律依据】《劳动合同法》第二十一条限制试用期内的解除权。',
      category: '劳动合同', status: 1, likeCount: 2, references: [LAW_L21],
      createdAt: '2026-09-11T09:30:00', createdAtText: '6天前' },
    { id: 39, question: '年假没休完可以折现吗？',
      answer: '【初步结论】应休未休年假可按日工资收入的 300% 支付。\n提示：需先经职工本人同意不安排休假。',
      category: '休息休假', status: 1, likeCount: 1, references: [LAW_L45],
      createdAt: '2026-09-08T14:00:00', createdAtText: '9天前' }
  ];

  var CT = [
    { id: 12, fileName: '劳动合同-张三.pdf', contractType: '劳动合同',
      partyA: '某某科技有限公司', partyB: '张三', riskLevel: '高', riskCount: 3,
      status: 1, createdAt: '2026-09-15T11:08:00' },
    { id: 11, fileName: '实习协议-张三.docx', contractType: '实习协议',
      partyA: '某某网络科技有限公司', partyB: '张三', riskLevel: '中', riskCount: 2,
      status: 1, createdAt: '2026-09-02T09:40:00' }
  ];

  var DOC = [
    { id: 21, title: '劳动仲裁申请书', templateName: '劳动仲裁申请书', templateId: 3,
      createdAt: '2026-09-13T17:44:00' },
    { id: 20, title: '离职通知书', templateName: '离职通知书', templateId: 5,
      createdAt: '2026-08-29T14:11:00' }
  ];

  var ARTICLES = [
    { id: 1, title: '试用期被辞退，有补偿吗？', summary: '关键看公司是否能证明「不符合录用条件」。', viewCount: 2018,
      content: '试用期内用人单位并非可以随意辞退。若公司主张你不符合录用条件，需要举证证明：一是有明确的录用条件并已告知你；二是有客观证据表明你不符合该条件；三是解除通知在试用期内送达。\n\n若公司无法举证，解除即属违法，你可主张赔偿金。', likeCount: 12, favorited: false },
    { id: 2, title: '劳动仲裁全流程：从申请到开庭', summary: '一般一年时效，拖欠工资在劳动关系存续期间不受限制。', viewCount: 1197,
      content: '仲裁流程：提交申请书 → 5 日内决定是否受理 → 受理后 45 日内结案（可延长 15 日）→ 开庭审理 → 出具裁决书。\n\n需准备材料：仲裁申请书、身份证明、劳动关系证明、证据清单。', likeCount: 8, favorited: false },
    { id: 3, title: '离职时公司不发最后一个月工资合法吗？', summary: '应按实际出勤结算，拖欠即违法。', viewCount: 1435,
      content: '不合法。劳动者离职时，用人单位应在解除或终止劳动合同时一次付清工资。\n\n若公司以「未办理交接」为由拒发，属于违法克扣，可向劳动监察部门投诉。', likeCount: 5, favorited: true },
    { id: 4, title: '没签劳动合同，你能拿多少二倍工资？', summary: '从用工满一个月的次日起算，最多可主张11个月。', viewCount: 1893,
      content: '用人单位自用工之日起超过一个月不满一年未订立书面劳动合同的，应当向劳动者每月支付二倍的工资。\n\n起算点：用工满一个月的次日；截止点：补签合同的前一日，最长 11 个月。', likeCount: 15, favorited: false },
    { id: 5, title: '竞业限制协议不给钱还有效吗？', summary: '未支付补偿金满三个月的，劳动者可以请求解除。', viewCount: 876,
      content: '竞业限制协议本身有效，但用人单位未按月支付经济补偿的，劳动者可以请求解除该协议。\n\n司法实践中，未支付补偿金满三个月，劳动者即可主张解除，且无需承担违约责任。', likeCount: 3, favorited: false }
  ];

  var FAV = { QA: 2, ARTICLE: 1, LAW: 1, DOC: 1 };

  /* 文书模板样本：字段名与 model/DocTemplate.java 对齐（name / category /
     description / placeholders 字符串数组）。placeholders 必须有值，
     否则 doc-drafting 的 renderGrid 会把「需填写 N 项」整行省掉，
     后面的「生成文书 → .zf-doc--sheet」路径就点不出来。 */
  var TPL = [
    { id: 3, name: '劳动仲裁申请书', category: '劳动维权',
      description: '向劳动人事争议仲裁委员会申请仲裁时提交的正式文书。',
      placeholders: ['申请人姓名', '身份证号', '被申请人名称', '请求事项', '事实与理由', '日期'] },
    { id: 5, name: '离职通知书', category: '劳动维权',
      description: '劳动者单方通知用人单位解除劳动合同的书面通知。',
      placeholders: ['姓名', '入职日期', '离职日期', '日期'] },
    { id: 7, name: '加班费追索函', category: '工资福利',
      description: '就未足额支付的加班工资向用人单位提出书面主张。',
      placeholders: ['姓名', '加班时间段', '金额'] }
  ];

  /* 生成的文书正文：必须自带「靠全角空格右推的落款行」，
     才能顺带验证 renderDocHtml 的落款识别 + .zf-doc__sign 右对齐。
     第一行做标题（renderDocHtml 会判成 .zf-doc__title）。 */
  var DOC_CONTENT = [
    '劳动仲裁申请书',
    '',
    '申请人：张三，男，1995年3月12日出生，汉族，住济南市历下区。',
    '被申请人：某某科技有限公司，住所地济南市高新区。',
    '',
    '请求事项：',
    '一、请求裁决被申请人支付解除劳动合同经济补偿金128,000.00元；',
    '二、请求裁决被申请人支付2026年8月至2026年9月期间工资合计23,500.00元。',
    '',
    '事实与理由：',
    '申请人于2021年7月1日入职被申请人处，双方签订书面劳动合同，约定月工资为16,000.00元。',
    '2026年9月13日，被申请人以「组织架构调整」为由单方解除劳动合同，未提前三十日通知，',
    '亦未依法支付经济补偿金。依据《中华人民共和国劳动合同法》第四十条、第四十六条之规定，',
    '被申请人应当支付经济补偿金。',
    '',
    '此致',
    '济南市劳动人事争议仲裁委员会',
    '',
    '　　　　　　　　　　　　　　　　　　申请人：张三',
    '　　　　　　　　　　　　　　　　　　2026年9月21日'
  ].join('\n');

  function page(list, params) {
    var size = parseInt((params || {}).pageSize, 10) || 10;
    return { total: list.length, pageNum: 1, pageSize: size, list: list.slice(0, size) };
  }

  function route(url, params) {
    var u = url.split('?')[0];
    params = params || {};
    if (u.indexOf('/auth/profile') >= 0 || u.indexOf('/auth/me') >= 0) { return USER; }
    /* 文书模板列表：返回数组（非分页信封），doc-drafting 的 loadTemplates
       直接 forEach。必须排在 /doc-records 之前，否则 '/doc-templates' 不含
       '/doc-records' 其实不会误命中，但顺序上放前面更稳妥。 */
    /* 模板详情 /doc-templates/:id —— 点模板卡时 useTpl() 靠它拿到 placeholders
       来渲染填写表单，缺这条路由就永远渲染不出 [data-ph] 字段。
       必须排在 /doc-templates 列表之前，否则会被列表规则吃掉（同 /knowledge/:id 的坑）。 */
    var tm = u.match(/\/doc-templates\/(\d+)$/);
    if (tm) {
      var tid = parseInt(tm[1], 10);
      for (var t2 = 0; t2 < TPL.length; t2++) {
        if (TPL[t2].id === tid) { return TPL[t2]; }
      }
      return TPL[0];
    }
    if (u.indexOf('/doc-templates') >= 0) { return TPL; }
    /* 生成文书：POST /doc-records，响应体是单条文书对象（不是分页） */
    if (u.indexOf('/doc-records') >= 0) {
      var tplId = parseInt(params.templateId, 10) || 3;
      var tname = '劳动仲裁申请书';
      for (var ti = 0; ti < TPL.length; ti++) {
        if (TPL[ti].id === tplId) { tname = TPL[ti].name; break; }
      }
      return { id: 99, title: tname, templateName: tname, templateId: tplId,
               content: DOC_CONTENT, createdAt: '2026-09-21T16:00:00' };
    }
    if (u.indexOf('/court-cases') >= 0 && u.indexOf('/mine') < 0) {
      /* court 推演提交：返回结果对象；刻意延迟由 verify 脚本用 CDP 控制，
         这里只保证结构完整，让 showResult() 能正常渲染。 */
      return {
        id: 501, title: params.title || '(未命名案情)', caseType: params.caseType || 'dismiss',
        winProbability: 68, compensationMin: 80000, compensationMax: 128000,
        similarCount: 1247,
        resultSummary: '【初步结论】公司未提前通知即解除劳动关系，属于违法解除，你有权主张赔偿金。\n'
                     + '【法律依据】《劳动合同法》第四十条要求提前三十日书面通知或额外支付一个月工资；'
                     + '第八十七条规定违法解除应按经济补偿标准的二倍支付赔偿金。'
      };
    }
    if (u.indexOf('/contracts') >= 0 && u.indexOf('/mine') < 0) {
      /* contract 审查提交：返回风险明细对象 */
      return {
        id: 601, fileName: params.fileName || '未命名合同',
        riskLevel: '高', riskCount: 3,
        risks: [
          { level: '高', clause: '试用期约定', desc: '试用期超过法定上限（三年以上合同不得超过六个月）。' },
          { level: '中', clause: '违约金条款', desc: '违约金数额过高，可能被认定为无效。' },
          { level: '低', clause: '竞业限制条款', desc: '未约定经济补偿，可能影响条款效力。' }
        ]
      };
    }
    if (u.indexOf('/qa/mine') >= 0) { return page(QA, params); }
    if (u.indexOf('/contracts/mine') >= 0) { return page(CT, params); }
    if (u.indexOf('/doc-records/mine') >= 0) { return page(DOC, params); }
    // 文章详情：/knowledge/:id 必须排在 /knowledge 列表之前，否则会被列表规则吃掉
    var dm = u.match(/\/knowledge\/(\d+)$/);
    if (dm) {
      var id = parseInt(dm[1], 10);
      for (var i = 0; i < ARTICLES.length; i++) {
        if (ARTICLES[i].id === id) { return ARTICLES[i]; }
      }
      return null;
    }
    if (u.indexOf('/knowledge') >= 0) { return page(ARTICLES, params); }
    if (u.indexOf('/favorites/exists') >= 0) { return false; }
    if (u.indexOf('/favorites/toggle') >= 0) { return true; }
    if (u.indexOf('/knowledge/') >= 0 && u.indexOf('/like') >= 0) { return null; }
    if (u.indexOf('/favorites') >= 0) {
      var t = params.targetType || 'QA';
      return { total: FAV[t] || 0, pageNum: 1, pageSize: 8, list: [] };
    }
    if (u.indexOf('/auth/logout') >= 0 || u.indexOf('/auth/password') >= 0) { return null; }
    return null;
  }

  var OPEN = XMLHttpRequest.prototype.open;
  var SEND = XMLHttpRequest.prototype.send;
  var SETHEADER = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    if (String(url).indexOf('login.html') >= 0) {
      this.__blocked = true;
      this.__url = String(url);
      return;
    }
    this.__method = method;
    this.__url = String(url);
    return OPEN.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function () {
    if (this.__blocked) { return; }
    return SETHEADER.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__blocked) { return; }
    var self = this;
    var url = self.__url || '';
    var params = {};
    var qi = url.indexOf('?');
    if (qi >= 0) {
      url.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('=');
        params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      });
    }
    if (body) {
      try {
        var parsed = JSON.parse(body);
        Object.keys(parsed).forEach(function (k) { params[k] = parsed[k]; });
      } catch (e) { /* 忽略 */ }
    }
    var data = route(url, params);
    var payload = JSON.stringify({ code: 10000, message: 'ok', data: data });
    setTimeout(function () {
      try {
        Object.defineProperty(self, 'readyState', { value: 4, configurable: true });
        Object.defineProperty(self, 'status', { value: 200, configurable: true });
        Object.defineProperty(self, 'responseText', { value: payload, configurable: true });
        Object.defineProperty(self, 'response', { value: payload, configurable: true });
        if (typeof self.onload === 'function') { self.onload(); }
        if (typeof self.onreadystatechange === 'function') { self.onreadystatechange(); }
        self.dispatchEvent(new Event('load'));
        self.dispatchEvent(new Event('loadend'));
      } catch (e) { console.log('STUB ERROR', e); }
    }, 20);
  };

  window.__ZF_STUB__ = route;
})();
