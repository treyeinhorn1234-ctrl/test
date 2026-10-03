--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2C",
	description = "An empty, plain corner room.",
	shape = "2C",
	commonness = 40,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2C",
	boundsMin = { -8, 0, -8 },
	boundsMax = { 25.6, 18.1708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { 6.403, 16.835, 6.397, 14.632, 2.672, 14.632 },
		dirtymetal = { 6.7, 15, 6.7, 28.2, 1.6, 28.2 },
		whitewall = { 8.988, 8.8, 9, 33.225, 17.6, 33.2 },
		metalpanels2 = { 8.7, 11.175, 8.7, 32.6, 4.85, 32.6 },
		door01 = { 6.788, 4, 14.388, 1.225, 8, 4.8 },
		concretefloor = { 9, 17.613, 9, 33.2, 0.025, 33.2 },
		tilefloor = { 8.8, 0, 8.8, 33.6, 0, 33.6 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 15.6, 12.8 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 12.8, 15.6, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0, 15.6, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 3.2, 1.6, 4.025 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
