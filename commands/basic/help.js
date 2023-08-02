const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Lists all available commands'),
	async execute(interaction) {
		const commandsCollection = interaction.client.commands;
		const commandList = [];

		// Loop through the entries in the Map
		// eslint-disable-next-line no-unused-vars
		for (const [commandName, commandData] of commandsCollection) {
			// Access the name and description properties of each commandData
			const name = commandData.data.name;
			const description = commandData.data.description;

			commandList.push(`\`${name}\`\n     ▸${description}`);
		}

		const commandListString = commandList.join('\n');

		const helpEmbed = new EmbedBuilder()
			.setTitle('List of available commands')
			.setDescription(`${commandListString}`)
			.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
			.setColor(0xdf3868);

		await interaction.reply({ embeds: [helpEmbed] });
	},
};
