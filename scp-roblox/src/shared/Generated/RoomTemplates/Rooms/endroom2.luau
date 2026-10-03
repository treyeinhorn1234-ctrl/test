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
	parts = {
		pipes = { -2.237, 12.034, 12.626, 11.03, 2.324, 24.336 },
		containment_doors = { 0, 5.161, -6.8, 21.964, 10.351, 4.604 },
		metalpanels = { 0, 5.2, 9.6, 23.2, 10.4, 32 },
		concretefloor = { -0.2, 13.2, 9.6, 23.6, 26.4, 32 },
		misc = { 0, 8.885, 11.026, 21.648, 2.974, 26.2 },
		dirtymetal = { -0.2, 5.35, 7.7, 23.6, 10.7, 34.2 },
	},
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
