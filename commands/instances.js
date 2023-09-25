const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { embedColor } = require('./findseeds.js');
const instanceTracker = require('../utils/instancetracker.js');
const { instanceCap } = require('../config.json')

let commandBody = new SlashCommandBuilder()
	.setName('instances')
	.setDescription('List running instances')



module.exports = {
	data: commandBody,
	async execute(interaction) {

		instanceList = instanceTracker.getInstanceList();
		if (instanceList.length == 0){
			await interaction.reply({ content: "There are no running instances." });
			return;
		}

		let instanceListEmbed = new EmbedBuilder()
			.setColor(embedColor)
			.setTitle('Active instances')
			.setDescription(`${instanceList.length} out of ${instanceCap}`)

		for (let instance of instanceList){
			instanceListEmbed.addFields({name: instance.items.join(','), value: `Floors: ${instance.floors}, by <@${instance.userId}>, id: ${instance.instanceCode}`})
		}
		//console.log(`\x1b[32m■\x1b[0m list: stopped ${killcounter} instances`)
		await interaction.reply({
			embeds: [instanceListEmbed]
	 });
	},
};
