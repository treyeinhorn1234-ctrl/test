--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3z3",
	description = "A three-door hallway.",
	shape = "3",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room3z3",
	boundsMin = { -25.6, 0, -14.4 },
	boundsMax = { 25.6, 10.9708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { 6.397, 9.635, 6.411, 14.632, 2.672, 14.604 },
		officewall = { 0, 4.8, 5.6, 51.2, 9.6, 40 },
		ceiling = { 0, 10, 9.6, 51.2, 0.8, 32 },
		misc = { 0, 9.938, 9.688, 51.2, 0.924, 31.824 },
		tilefloor = { 0, 0, 5.6, 51.2, 0, 40 },
		dirtymetal = { 0, 9.538, 1.388, 18, 0.124, 15.224 },
		metal = { 0, 4.8, -2.8, 17.6, 9.6, 23.2 },
		metalpanels = { 0, 2.401, -12.589, 13.5, 1.303, 1.677 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 9.2239, -5.9261 },
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
