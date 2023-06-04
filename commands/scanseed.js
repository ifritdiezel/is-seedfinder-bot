const { SlashCommandBuilder } = require('discord.js');
const { spawn } = require('child_process');
const { versionName, jarName } = require('../config.json');
const fs = require('fs');
const path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('scanseed')
		.setDescription('Generate a report for a given seed. Accepts numbers only')
		.addIntegerOption(option =>
      option.setName('seed')
     .setDescription('Number of the seed to scan')
		 .setRequired(true)
     .setMinValue(0)
		 .setMaxValue(5429503678976))
		 .addBooleanOption(option =>
			 option.setName('runes_on')
			 .setDescription('Scan with Forbidden Runes on. Less SoU affects dungeon generation')
			 .setRequired(false) )
		 .addBooleanOption(option =>
			 option.setName('barren_on')
			 .setDescription('Scan with Barren Lands on. Lack of random plants affects generation.')
			 .setRequired(false) ),
		 async execute(interaction) {

			 let runesOn = interaction.options.getBoolean('runes_on') ?? false;
			 let barrenOn = interaction.options.getBoolean('barren_on') ?? false;
			 var spawnflags = "-";											//quiet mode enabled to only print seed codes to console
			 if (runesOn) spawnflags += 'r';						//forbidden runes flag
			 if (barrenOn) spawnflags += 'b';						//barren lands flag

			 var seedtoscan = interaction.options.getInteger('seed');
			 let outputfile = "scanresults/ShPD-" + versionName + "-" + seedtoscan + ".txt";
			 var child = spawn('java', ['-jar', jarName, "scan", 24, seedtoscan, outputfile, spawnflags]);

			 child.on('close', (code) => {
				 interaction.reply({ content: `<:rocc:1077978311893983262> Detailed report for ${versionName} seed ${seedtoscan}${runesOn ? " __with Forbidden Runes on__" : ""}${barrenOn ? " __with Barren Lands on__" : ""}:`, files: [outputfile] });
				 //FUCK it does NOT work. some timing issue
				 //fs.unlink( path.join(__dirname, "/../" + outputfile )  ,function(err){if(err) return console.log(err);});
			 });

		 },
};
