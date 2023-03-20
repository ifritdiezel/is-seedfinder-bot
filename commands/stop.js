const { SlashCommandBuilder } = require('discord.js');
const { embedColor } = require('./findseeds.js');
const instanceTracker = require('../instancetracker.js');
const { spawn } = require('child_process');
const { instanceCap } = require('../config.json')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('WIP'),
	async execute(interaction) {
		instanceList = instanceTracker.getInstanceList();
		//console.log(instanceList);
		let killcounter = 0;
		let newinstancelist = []
		for (let instance of instanceList){
			if (interaction.member.id === instance.userId){
				instance.kill('SIGINT');
				killcounter++;
			}
			//else newinstancelist.push(instance);
		}
		//instanceTracker.setInstanceList(newinstancelist);
		await interaction.reply({
			content: killcounter ? `Stopped ${killcounter} instance${killcounter > 1 ? "s" : ""}.` : `You do not have any running instances.`,
			embeds: [{color: embedColor, description:`Free instances: ${(instanceCap - instanceTracker.getInstanceList.length)}`}]
	 });
	},
};
