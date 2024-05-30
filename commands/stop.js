const { SlashCommandBuilder } = require('discord.js');
const { embedColor } = require('./findseeds.js');
const instanceTracker = require('../utils/instancetracker.js');
const { spawn } = require('child_process');
const { instanceCap, ownerId, modRoleId } = require('../config.json')

module.exports = {
	data:  new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stop all instances you started.')

		.addBooleanOption(option =>
			option.setName('force')
			.setDescription('Owner only. Stops all instances.')
			.setRequired(false))

		.addIntegerOption(option =>
			option.setName('id')
			.setDescription('Stops the instance with the given id.')
			.setRequired(false) ) ,

	async execute(interaction) {
		let force = interaction.options.getBoolean('force') ?? false;
		let id = interaction.options.getInteger('id') ?? false;

		if (force && ownerId && interaction.member.id != ownerId && !interaction.member.roles.cache.has(modRoleId)){
			await interaction.reply({ content: "You don't have permission to use the **force** argument.", ephemeral: true });
			return;
		}


		instanceList = instanceTracker.getInstanceList();
		//console.log(instanceList);
		let killcounter = 0;
		let newinstancelist = []
		if (id) {
			let response = "No instance with this id found.";
			for (let instance of instanceList){
				if (instance.instanceCode == id){
					if ((interaction.member.id == instance.userId) || force){
						instance.kill('SIGINT');
						killcounter++;
						response = 'Instance '+ id +' stopped.';
					} else {
						response = 'You do not own this instance.';
					}
					break;
				}
			}
			await interaction.reply({
				content: response,
				embeds: [{color: embedColor, description:`Free instances: ${(instanceCap - instanceTracker.instanceCounter()) + killcounter}`}]
		 });

		} else {
			for (let instance of instanceList){
				if ((interaction.member.id == instance.userId) || force){
					instance.kill('SIGINT');
					killcounter++;
				}
			}
			await interaction.reply({
				content: killcounter ? `Stopped ${killcounter} instance${killcounter > 1 ? "s" : ""}.` : `You do not have any running instances.`,
				embeds: [{color: embedColor, description:`Free instances: ${(instanceCap - instanceTracker.instanceCounter()) + killcounter}`}]
		 });
		}
		console.log(`\x1b[32m■\x1b[0m stopper: stopped ${killcounter} instances`)

	},
};
