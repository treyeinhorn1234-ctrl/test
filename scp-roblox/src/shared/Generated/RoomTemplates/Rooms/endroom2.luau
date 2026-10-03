--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "endroom2",
	description = "A small, red-lit, HCZ-styled endroom.",
	shape = "1",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 2 },
	asset = "endroom2",
	boundsMin = { -12, -0.0141, -9.4 },
	boundsMax = { 11.6, 26.4, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 10.4761, 7.7, -1.5739 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.3,
		},
		{
			position = { -10.4761, 7.7, -1.5739 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.3,
		},
		{
			position = { -5.6478, 10.0239, 23.6261 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.3,
		},
		{
			position = { 5.6522, 10.0239, 23.6261 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.3,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.6, 0 },
	},
	sounds = {
		{
			position = { -0.8, 4.8, -12.8 },
			ambience = 6,
			range = 10,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
