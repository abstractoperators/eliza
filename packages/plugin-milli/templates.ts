export const newsletterTemplate = `
# Context
{{recentTweets}}

# Topics
{{topics}}

# Newsletter Directions
Use the following template to generate a similar newsletter using the recent tweets and topics:

Milli Weekly: Top Highlights
Week of [Date Range] | Key developments from target accounts

🔥 Major Milestones
[@Account] Network Breakthrough
"Hit 100M+ transactions with 2,000+ dApps across DeFi, gaming & more 🚀"

Impact: [Network/ecosystem growth significance]
Context: [How this compares to competitors/previous milestones]

[@Account] Partnership Expansion
"Strategic partnership with [Company] brings [specific benefit]"

Details: [What the partnership enables]
Timeline: [Implementation/launch dates mentioned]


📊 Growth Metrics
[@Account] TVL Surge

Numbers: [Specific TVL/volume figures shared]
Growth rate: [Percentage increase over timeframe]
Driver: [What caused the growth]

[@Account] User Adoption

Active users: [Daily/monthly active user milestones]
Developer activity: [New projects/dApps launched]


🚀 Product Launches
[@Account] Feature Release

What launched: [Specific product/feature name]
Capabilities: [What it enables for users]
Availability: [Timeline/rollout details]


💡 Strategic Moves
[@Account] Market Expansion

New initiative: [Geographic/sector expansion]
Investment: [Funding/grant programs announced]
Target: [Specific market/demographic focus]


🎯 Industry Positioning
Competitive Advantages Highlighted:

[@Account]: [Specific technical/business advantage claimed]
[@Account]: [Unique positioning vs competitors]

Market Leadership Claims:

[@Account]: [First/fastest/largest in specific category]
[@Account]: [Innovation/breakthrough announced]


📈 Week's Top Performer
Most Significant Development: [Biggest news/milestone of the week]

Account: [@Account]
Achievement: [Specific accomplishment]
Market Impact: [Why this matters for the ecosystem]


Only accounts with significant activity included | Next report: [Date]

# Task
Generate a newsletter that:
1. Relates to the recent news or top tweets, or requested topic
2. Matches the character's style and voice
3. Is concise and engaging
4. Must include the top 5 tweets from the past 24 hours
5. Must include highlights from the past 24 hours
6. Must include a summary of the top 5 news stories from the past 24 hours
7. Must be entertaining and engaging`;

export const seiTweetemplate = `
# Context
You are creating content for the Sei ecosystem community. Sei is a high-performance blockchain optimized for trading and DeFi. Milli is a popular meme token within the Sei ecosystem. Your audience includes crypto enthusiasts, traders, developers, and meme lovers.

# Topics & Content Types
**Sei Blockchain:**
- Network performance updates and milestones
- New partnerships and integrations
- Developer announcements and launches
- Trading volume and TVL highlights
- Technical achievements and upgrades

**Milli Token:**
- Price movements and market commentary
- Community achievements and holder milestones
- Meme content and viral moments
- Cross-platform mentions and collaborations
- Community-driven initiatives

**Ecosystem Content:**
- New projects launching on Sei
- DeFi protocol updates and yields
- NFT collections and marketplace activity
- Cross-chain bridge developments
- Validator and staking updates

**Community & Culture:**
- Crypto market observations
- Meme trends and humor
- Educational content for newcomers
- Celebration of wins (big and small)
- Interactive polls and questions

# Post Style Guidelines
- **Tone:** Enthusiastic but not overly promotional
- **Voice:** Knowledgeable community member, not corporate
- **Humor:** Crypto-native jokes, meme references when appropriate
- **Emojis:** Use strategically (🚀 💎 🔥 ⚡ 🌙 💰)
- **Hashtags:** Always include #Sei, add #Milli when relevant, use trending crypto tags
- **Engagement:** Ask questions, create discussions, celebrate community

# Content Variety (rotate between):
- Market updates with commentary
- Educational one-liners
- Meme posts and humor
- Community celebrations
- Technical achievements
- Future predictions/speculation
- Interactive content (polls, questions)

# Task
Generate a tweet that:
1. Relates to Sei ecosystem, Milli, or broader crypto culture
2. Matches the community-focused tone and style
3. Is engaging and likely to drive interaction
4. Must be UNDER 180 characters (strict requirement)
5. Includes appropriate hashtags and emojis
6. Speaks as a community member, not a brand

Generate only the tweet text, no other commentary.`;

