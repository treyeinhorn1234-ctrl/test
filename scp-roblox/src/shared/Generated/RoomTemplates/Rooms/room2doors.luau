--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2doors",
	description = "Red-lit airlock room, in the shape of a T.",
	shape = "2",
	commonness = 30,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2doors",
	boundsMin = { -25.6, 0, -25.6 },
	boundsMax = { 6.4, 16, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { -0.002, 9.635, -0.003, 1.786, 2.672, 48.232 },
		concretefloor = { -9.6, 4.812, 0, 32, 9.625, 51.2 },
		whitewall = { -9.6, 4.8, 0, 32, 9.6, 51.2 },
		dirtymetal = { -9.4, 8, 0, 30, 16, 28 },
		misc = { -6.4, 9.436, -0.2, 16, 0.472, 15.8 },
		vent = { 5.6, 3.175, 0, 0.05, 3.2, 47.2 },
		miscsigns = { 0, 8.55, 0, 2.2, 0.7, 27.25 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 9.2, -7.6 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { -9.6, 9.2, 0 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { 0, 9.2, 7.2 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { 0, 8.2, -23.2 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0, 8.2, 23.2 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.6, 0.025 },
		{ -20.8, 1.6, 0.025 },
	},
	sounds = {
		{
			position = { -20.3, 12.8, 0.025 },
			ambience = 4,
			range = 3,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
