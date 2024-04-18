let _recentRequests = {};

exports.setLastRequest = function(request){
	_recentRequests[request.userId] = request;
};

exports.getLastRequest = function(userid){
	return _recentRequests[userid];
};
