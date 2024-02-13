allitems = require("./itemlists.json");
ouritems = allitems.artifacts;

for (listkey of Object.keys(ouritems)){
	console.log(`else if (input.contains("${listkey}")) return new ${ouritems[listkey].charAt(0).toUpperCase() + ouritems[listkey].slice(1).replaceAll(" ", "")}();`)
}
