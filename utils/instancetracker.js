const { instanceCap } = require('../config.json')
var _instanceList = [];
var longscanUsers = [];
var instances = 0;


var _instanceNameList = Array.from({length: instanceCap}, (x, i) => i);
const allowedInstances = _instanceNameList.slice(0); //if you don't slice it it just makes a reference to the original array??????????

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
  _instanceList = newinstancelist;
};

exports.addInstance = function(instance){
	_instanceList.push(instance)
}

exports.freeInstanceTracker = function(reserve){
	if (reserve) return `Free instances: ${_instanceNameList.length - 1}`
  else return `Free instances: ${_instanceNameList.length}`
}

exports.full = function(){
	return _instanceList.length >= instanceCap || !_instanceNameList;
}

exports.instanceCounter = function(){
	return _instanceList.length;
}

exports.getNewInstanceName = function(){
	return _instanceNameList.pop();
}

exports.freeInstanceName = function(name){
	//console.log("\x1b[32m■\x1b[0m tracker: returning instance " + name)
	if (allowedInstances.includes(name)) _instanceNameList.push(name);
	else console.log("\x1b[32m■\x1b[0m tracker: discarding instance", name);
	_instanceList = _instanceList.filter(iinstance => iinstance.instanceCode != name);
	//console.log("\x1b[32m■\x1b[0m tracker: new instance list: " + _instanceNameList);
}
