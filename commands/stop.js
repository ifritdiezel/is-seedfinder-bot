const { SlashCommandBuilder } = require('discord.js');
const { embedColor } = require('./findseeds.js');
const instanceTracker = require('../utils/instancetracker.js');
const { spawn } = require('child_process');
const { instanceCap, ownerId } = require('../config.json')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stop all instances you started.')
		.addBooleanOption(option =>
			option.setName('force')
			.setDescription('Owner only. Stops all instances.')
			.setRequired(false) ),
	async execute(interaction) {
		let force = interaction.options.getBoolean('force') ?? false;
		if (force && interaction.member.id != ownerId){
			await interaction.reply({ content: "You don't have permission to use the **force** argument.", ephemeral: true });
			return;
		}


		instanceList = instanceTracker.getInstanceList();
		//console.log(instanceList);
		let killcounter = 0;
		let newinstancelist = []
		for (let instance of instanceList){
			if ((interaction.member.id === instance.userId) || force){
				instance.kill('SIGINT');
				killcounter++;
			}
			//else newinstancelist.push(instance);
		}
		console.log(`stopper: stopped ${killcounter} instances`)
		await interaction.reply({
			content: killcounter ? `Stopped ${killcounter} instance${killcounter > 1 ? "s" : ""}.` : `You do not have any running instances.`,
			embeds: [{color: embedColor, description:`Free instances: ${(instanceCap - instanceTracker.instanceCounter()) + killcounter}`}]
	 });
	},
};
