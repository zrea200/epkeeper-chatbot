async function main(data) {

	let inputText = (data && (data.input || data.text || data.content || "")) + "";
  
	const KEY_MAP = {
	  "姓名": "names",
	  "手机号码": "mobile",
	  "手机号": "mobile",
	  "性别": "gender",
	  "所属校区": "campusids",
	  "校区": "campusids",
	  "业务模式": "businessids",
	  "线索来源": "source",
	  "渠道来源": "source",
	  "渠道名称": "resellername",
	  "渠道代理": "resellername",
	  "活动名称": "activityname",
	  "负责人": "usernames",
	  "市场人员": "marketnames",
	  "线下广告来源": "offlineadsource",
	  "离线广告来源": "offlineadsource",
	  "关联号码": "telphone",
	  "微信": "wechat",
	  "QQ号码": "qq",
	  "电子邮箱": "email",
	  "父亲手机号码": "fathermobile",
	  "母亲手机号码": "mothermobile",
	  "学员状况": "studentstate",
	  "学校类型": "schooltype",
	  "学校": "schoolname",
	  "年级": "schoolenrollment",
	  "专业": "professionname",
	  "公司": "companyname",
	  "职位": "positionname",
	  "备注信息": "note",
	  "审核结果": "audit_result",
	  "分配表": "tablename",
	  "分配群": "groupname",
	  "分配群编号": "groupid",
	  "用户ID": "userid"
	};
  
	const DEFAULTS = {
	  orgids: "",
	  campusids: "",
	  names: "",
	  mobile: "",
	  gender: "",
	  source: "",
	  resellername: "",
	  activityname: "",
	  businessids: "",
	  marketnames: "",
	  usernames: "",
	  telphone: "",
	  wechat: "",
	  qq: "",
	  email: "",
	  studentstate: "",
	  schooltype: "",
	  schoolname: "",
	  schoolenrollment: "",
	  professionname: "",
	  companyname: "",
	  positionname: "",
	  note: "",
	  fathermobile: "",
	  mothermobile: "",
	  offlineadsource: "",
	  audit_result: "",
	  tablename: "",
	  groupname: "",
	  userid: "",
	  groupid: 0
	};
  
	function normalize(text) {
	  return (text || "")
		.replace(/\s+/g, " ")
		.replace(/[；;]+/g, ";")
		.replace(/[：:]/g, ":")
		.trim();
	}
  
	function extractMobile(value) {
	  const m = (value || "").match(/(?<!\d)1[3-9]\d{9}(?!\d)/);
	  return m ? m[0] : "";
	}
  
	const result = { ...DEFAULTS };
  
	const normalized = normalize(inputText);
	if (!normalized) {
	  return { data: result };
	}
  
	// 从左到右解析，识别真正的键值对
	// 策略：真正的键值对格式是 "; 键名:" 或 "^键名:"（字符串开头）
	const keyNames = Object.keys(KEY_MAP);
	// 按长度从长到短排序，避免短键名匹配到长键名的一部分
	keyNames.sort((a, b) => b.length - a.length);
	
	const text = normalized;
	// 找到所有键值对的位置
	const pairs = [];
	
	for (const key of keyNames) {
	  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	  
	  // 匹配模式1：字符串开头的键名（"键名:"）
	  if (text.startsWith(key)) {
		let colonPos = key.length;
		while (colonPos < text.length && text[colonPos] === ' ') {
		  colonPos++;
		}
		if (colonPos < text.length && text[colonPos] === ':') {
		  let valueStart = colonPos + 1; // 冒号后的位置，不跳过空格
		  pairs.push({
			key: key,
			matchStart: 0,
			valueStart: valueStart
		  });
		}
	  }
			
	  // 匹配模式2："; 键名:"（分号+空格+键名+冒号）
	  const pattern = new RegExp(`;\\s+${escapedKey}\\s*:`, 'g');
	  let match;
	  while ((match = pattern.exec(text)) !== null) {
		const matchStart = match.index; // 分号的位置
		let valueStart = match.index + match[0].length; // 冒号后的位置，不跳过空格
		pairs.push({
		  key: key,
		  matchStart: matchStart,
		  valueStart: valueStart
		});
	  }
	}
	
	// 去重并按位置排序
	const uniquePairs = [];
	const seen = new Set();
	for (const pair of pairs) {
	  const key = `${pair.matchStart}_${pair.key}`;
	  if (!seen.has(key)) {
		seen.add(key);
		uniquePairs.push(pair);
	  }
	}
	uniquePairs.sort((a, b) => a.matchStart - b.matchStart);
	
	// 提取每个键值对的值（值到下一个键的 matchStart 之前）
	for (let i = 0; i < uniquePairs.length; i++) {
	  const pair = uniquePairs[i];
	  const nextPair = uniquePairs[i + 1];
	  
	  // 值的结束位置是下一个键的 matchStart（分号的位置）
	  const valueEnd = nextPair ? nextPair.matchStart : text.length;
	  
	  let val = text.slice(pair.valueStart, valueEnd).trim();
			
	  // 如果值以分号开头，说明冒号后直接是分号（空值）
	  // 或者值中包含未知的键名，需要在第一个分号处截断
	  if (val.startsWith(';')) {
		val = "";
	  } else {
		// 找到第一个 "; " 模式（分号+空格），这可能是未知键的开始
		const semicolonIndex = val.indexOf('; ');
		if (semicolonIndex !== -1) {
		  // 检查分号后是否是未知键（不在 KEY_MAP 中）
		  const afterSemicolon = val.slice(semicolonIndex + 2);
		  let isUnknownKey = false;
		  for (const unknownKey of ["跟进状态", "与学生关系", "负责人排名"]) {
			if (afterSemicolon.startsWith(unknownKey + ':') || afterSemicolon.startsWith(unknownKey + ' :')) {
			  isUnknownKey = true;
			  break;
			}
		  }
		  if (isUnknownKey) {
			val = val.slice(0, semicolonIndex).trim();
		  }
		}
	  }
			
	  const field = KEY_MAP[pair.key];
			
	  if (field === "mobile") {
		const mobile = extractMobile(val);
		result.mobile = mobile || "";
	  } else if (field === "groupid") {
		const num = Number((val || "").replace(/[^0-9.-]/g, ""));
		result[field] = Number.isFinite(num) && num !== 0 ? num : 0;
	  } else if (field === "userid") {
		const num = Number((val || "").replace(/[^0-9.-]/g, ""));
		result[field] = Number.isFinite(num) && num !== 0 ? num : "";
	  } else {
		result[field] = val;
	  }
	}
  
	return { data: result };
  
  }