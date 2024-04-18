//this interpolates all the data in the request to prefill and correct most fields
//hypothetically this is supposed to be able to generate a valid request body from just 2 values, floors and items

function prefillRequest(originalRequest){
	let request = originalRequest;

	if (request.natLangString){

		request.natLangString = request.natLangString.toLowerCase().replaceAll("_","");
		for (flag of ["disableAutocorrect","longScan","runesOn","barrenOn","darknessOn","showConsumables","uncurse","exactUpgrades"]){
			request[flag] = request.natLangString.includes(flag.toLowerCase());
			request.natLangString = request.natLangString.replaceAll(flag.toLowerCase(), "");
		}
		request.natLangString = request.natLangString.replace(/\s+/g,' ');
		request.natLangString = request.natLangString.replaceAll("find seed", "findseed");


		let nlfloors = "";
		natLangItemsArray = [];
		let nlitems = "";
		args = natLangString.split(" ");

		//if you don't understand this that's fine probably
		let nowListingItems = false;
		for (let i = 0; i < args.length; i++){
			let commandWord = args[i];
			let nPreviousCommandWord = args[i-1] || "";
			nPreviousCommandWord = nPreviousCommandWord.replace(/\D/g,'');
			let nNextCommandWord = args[i+1] || "";
			nNextCommandWord = nNextCommandWord.replace(/\D/g,'');

			if (commandWord.includes("floor") || commandWord.includes("depth") || commandWord.includes("before")){
				if (commandWord.includes(":")) {
					nlfloors = commandWord.split(":")[1] || "";
					nlfloors = nlfloors.replace(/\D/g,'');
				}
			 	if (nNextCommandWord && !isNaN(nNextCommandWord)) nlfloors = nNextCommandWord;
				else if (nPreviousCommandWord && !isNaN(nPreviousCommandWord)) nlfloors = nPreviousCommandWord;
				nowListingItems = false;
			}

			else if (commandWord.includes("item") || commandWord.includes("request")){
				nowListingItems = true;
				if (commandWord.includes(":") && commandWord.split(":")[1]) items += commandWord.split(":")[1];
			}
			else if (nowListingItems) natLangItemsArray.push(commandWord);
		}

		request.items = request.items || natLangItemsArray.join(" ");
	}

	request.seedstoscan = (request.floors<=5) ? minSeedsToScan*2 : minSeedsToScan;
	if (request.floors == 1) request.seedstoscan = minSeedsToScan*10;
	if (request.longScan) {
		request.seedstoscan = 10000000;
	}

	if (!request.startingseed) request.startingseed = Math.floor(Math.random() * (5429503678976-request.seedstoscan))

	request.writeToFile = (request.floors > 10) || request.showConsumables || request.seedsToFind > 1;
}
