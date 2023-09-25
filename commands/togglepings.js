const { SlashCommandBuilder } = require('discord.js');
const { noPingRoleId } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('toggle_pings')
		.setDescription('Makes the bot not ping you. Use this again to turn pings back on.'),
	async execute(interaction) {
		if (!noPingRoleId){
			await interaction.reply({ content: 'The owner must specify an assignable role in the bot config to enable this command.' });
			return;
		}
		const member = interaction.member;

		if (member.roles.cache.has(noPingRoleId)) {
			member.roles.remove(noPingRoleId);
			await interaction.reply({ content: '<:doot:1077978268881404065> Opted you back into receiving pings.', ephemeral: true });
		} else {
			member.roles.add(noPingRoleId);
			await interaction.reply({ content: '<:ratpotion:1077978306500104232> Opted you out from receiving pings. Use this command again to reenable them.', ephemeral: true });
		}




	},
};
