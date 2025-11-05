async function main(data) {
	const name = data.name;
	const record = data.record;
     const systemStatus = data.systemStatus;

	console.log(name, record);
	// 技能1: 通知数据中心处理 - 当负责人为特定值时返回0
	const notifyDataCenter = [
		"AFS 顾问跟进", "AMS 顾问跟进", "EAS 老学员", "KW 老学员", 
		"活动邀约", "京东 7 天未回访", "京东 D1 类数据库", "京东零回访", 
		"京东每周清理", "周婧（不核算业绩）", "已购课", "上师高艺丹","无效数据库"
	];
	
	// 技能2: 重新分配处理 - 当负责人为特定值时返回1
	const reassignHandlers = [
		"宝华曜顾问跟进", "近期公共池", "京东未接类数据库", "京东已出国数据", 
		"离职顾问", "推送分校", "暂不分配", "null","空值","-"
	];
	
	// 技能3: 无效数据处理 - 只要跟进记录为"无效数据"、"停机"、"空号"、"错号"、"SPY"、"内部员工"则返回2（不再判断grade）
	const invalidRecords = ["无效数据", "停机", "空号", "错号", "SPY", "内部员工"];
	if (invalidRecords.includes(record)) {
		return {"response": 2, "name": name};
	}
	
	// 技能4: 系统状态处理 - 当系统状态为"已购课"时返回0
	if (systemStatus === "已购课") {
		return {"response": 0, "name": name + "，已购课数据"};
	}
	
	// 如果name在通知数据中心列表中，返回0
	if (notifyDataCenter.includes(name)) {
		return {"response": 0, "name": name};
	}
	
	// 如果name在重新分配列表中，返回1
	if (reassignHandlers.includes(name)) {
		return {"response": 1, "name": name};
	}
	
	// 如果name以"淘宝"开头，返回1（重新分配处理）
	if (name.startsWith("淘宝")) {
		return {"response": 1, "name": name};
	}
	
	// 如果name是"人名"（即除了上述特定类型外的所有人名），返回0
	if (name !== "无效数据库" && !notifyDataCenter.includes(name) && !reassignHandlers.includes(name)) {
		return {"response": 0, "name": name};
	}
	
	// 其他情况默认返回1（重新分配处理）
	return {"response": 1, "name": name};
  }
  