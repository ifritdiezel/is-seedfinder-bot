const { instanceCap } = require('../config.json')
var _instanceList = [];
var longscanUsers = [];
var instances = 0;


var _instanceNameList = Array.from({length: instanceCap}, (x, i) => i);


exports.addLongscanUser = function(userid){
	longscanUsers.push(userid);
};

exports.removeLongscanUser = function(userid){
	var index = longscanUsers.indexOf(userid);
  if (index > -1) {
    longscanUsers.splice(index, 1);
  }
};

exports.checkLongscanUser = function(userid){
	return longscanUsers.includes(userid);
};

exports.getInstanceList = function() {
  return _instanceList;
};

exports.setInstanceList = function(newinstancelist) {
  //validate the name...
  _instanceList = newinstancelist;
};

exports.addInstance = function(instance){
	_instanceList.push(instance)
}

exports.freeInstanceTracker = function(){
  return `Free instances: ${_instanceNameList.length}`
}

exports.full = function(){
	return _instanceList.length >= instanceCap;
}

exports.instanceCounter = function(){
	return _instanceList.length;
}

exports.getNewInstanceName = function(){
	return _instanceNameList.pop();
}

exports.freeInstanceName = function(name){
	console.log("tracker: returning instance " + name)
	_instanceNameList.push(name);
	_instanceList = _instanceList.filter(iinstance => iinstance.instanceCode != name);
	console.log("tracker: new instance list: " + _instanceNameList);
}
