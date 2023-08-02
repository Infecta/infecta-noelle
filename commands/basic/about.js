const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('Prints info about this bot'),
	async execute(interaction) {
		const aboutEmbed = new EmbedBuilder()
			.setColor(0xdf3868)
			.setTitle('About me')
			.setDescription(
				'I\'m a Discord bot developed by [Infecta](https://node.infecta.xyz) to mainly serve osu! stats\n\n[**Github**](https://github.com/infecta.xyz)',
			)
			.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
			.setFooter({ text: 'Noelle my beloved' });

		await interaction.reply({ embeds: [aboutEmbed] });
	},
};
