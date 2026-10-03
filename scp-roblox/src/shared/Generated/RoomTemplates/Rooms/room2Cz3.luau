--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2Cz3",
	description = "A corner room, with two benches against the walls.",
	shape = "2C",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room2Cz3",
	boundsMin = { -14.4, -0.025, -14.4 },
	boundsMax = { 25.6, 10.9708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { 6.397, 9.635, 6.411, 14.632, 2.672, 14.604 },
		officewall = { 5.6, 4.8, 5.6, 40, 9.6, 40 },
		ceiling = { 5.6, 10, 9.6, 40, 0.8, 32 },
		misc = { 7.7, 9.938, 7.688, 35.8, 0.924, 35.824 },
		tilefloor = { 5.6, -0.013, 5.6, 40, 0.025, 40 },
		dirtymetal = { -0.6, 9.538, -0.612, 19.2, 0.124, 19.224 },
		metal = { -2.8, 4.8, -2.8, 23.2, 9.6, 23.2 },
		metalpanels = { -4.145, 2.401, -3.932, 18.59, 1.303, 18.99 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 2.4, 9.2239, -9.9261 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
		{
			position = { -9.9022, 9.2239, 3.1761 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
		{
			position = { 0.0261, 10.1239, 19.2 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
		{
			position = { 19.2, 10.1239, -0.0261 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
	},
	spotlights = {},
	waypoints = {
		{ 8, 2, -0.0063 },
		{ 0, 2, 7.9938 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
