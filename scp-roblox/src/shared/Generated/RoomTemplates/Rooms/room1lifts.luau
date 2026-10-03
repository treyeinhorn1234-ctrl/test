--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room1lifts",
	description = "A dead-end room with two elevators.",
	shape = "1",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room1lifts",
	boundsMin = { -11.6, -0.9005, -2.6424 },
	boundsMax = { 11.2, 11.6713, 25.6 },
	parts = {
		metal = { 0.035, 3.616, -2.071, 17.794, 9.033, 1.142 },
		["2_office_lamps_dif"] = { -0.001, 10.006, 11.601, 1.814, 3.331, 1.86 },
		grass2 = { -1.975, 4.575, 10.958, 17.851, 9.15, 26.067 },
		officewall = { -0.2, 4.8, 11.788, 22.8, 9.601, 27.625 },
		tilefloor = { -0.1, 0, 11.6, 22.2, 0, 28 },
		concretefloor = { -0.1, 9.625, 11.6, 22.6, 0.05, 28 },
		dirtymetal = { 0.05, 8.9, -1.8, 14.2, 0.8, 0.6 },
		boxfile_a = { -5.746, 8.9, -1.775, 0.593, 0.5, 0.6 },
		slh_miscsigns = { 3.737, 7.175, -1.775, 7.525, 3.6, 0.4 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 8.3, 11.65 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
