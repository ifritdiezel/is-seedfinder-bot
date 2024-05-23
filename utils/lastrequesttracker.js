let _recentRequests = {};
let _lastFindingResult = {};
let _lastGlobalResult = null;

exports.setLastRequest = function(request){
	_recentRequests[request.userId] = request;
};

exports.getLastRequest = function(userid){
	return _recentRequests[userid];
};

exports.setLastResult = function(userid, seed){
	_lastFindingResult[userid] = seed;
};

exports.getLastResult = function(userid){
	return _lastFindingResult[userid];
};

exports.setLastGlobalResult = function(seed){
	_lastGlobalResult = seed;
};

exports.getLastGlobalResult = function(){
	return _lastGlobalResult;
};
