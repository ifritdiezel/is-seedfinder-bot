const { instanceCap } = require('./config.json')
var _instanceList = [];
var instances = 0;

var _instanceNameList = Array.from({length: instanceCap}, (x, i) => i);


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
	_instanceNameList.push(name);
	_instanceList = _instanceList.filter(iinstance => iinstance.instanceCode != name);
	console.log(_instanceNameList);
}
