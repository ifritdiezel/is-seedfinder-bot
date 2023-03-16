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
		 .setMaxValue(5429503678976)),
		 async execute(interaction) {
			 var seedtoscan = interaction.options.getInteger('seed');
			 let outputfile = "scanresults/ShPD-" + versionName + "-" + seedtoscan + ".txt";
			 var child = spawn('java', ['-jar', jarName, 24, seedtoscan, outputfile]);

			 child.on('close', (code) => {
				 interaction.reply({ content: `<:rocc:1077978311893983262> Detailed report for ${versionName} seed ${seedtoscan}:`, files: [outputfile] });
				 //FUCK it does NOT work. some timing issue
				 //fs.unlink( path.join(__dirname, "/../" + outputfile )  ,function(err){if(err) return console.log(err);});
			 });

		 },
};
