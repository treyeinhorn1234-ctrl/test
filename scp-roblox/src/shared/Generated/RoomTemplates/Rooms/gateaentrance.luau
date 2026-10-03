--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "gateaentrance",
	description = "The room with the elevator to Gate A.",
	shape = "1",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "gateaentrance",
	boundsMin = { -18, -0.8, -31 },
	boundsMax = { 34, 33.2, 28.4 },
	parts = {
		["2_office_lamps_dif"] = { -0.002, 20.835, -10.003, 1.786, 2.672, 23.432 },
		containment_doors = { 0, 5.161, -9.7, 21.964, 10.351, 42.004 },
		pipes = { 0.007, 26.459, -12.7, 9.616, 1.212, 5.919 },
		tilefloor = { 0.2, -0.013, -1.2, 36.4, 0.025, 53.6 },
		concretefloor = { 7.6, 16.6, -1.2, 51.2, 33.2, 53.6 },
		dirtymetal = { 7.7, 16.6, -3.1, 51, 33.2, 55.8 },
		officewall = { 0.2, 4.4, 0.2, 36.4, 8.8, 56.4 },
		whitewall = { 0.2, 11.2, 0.2, 36.4, 12.8, 56.4 },
		metalpanels2 = { -0.4, 11.175, 1.4, 35.2, 4.85, 54 },
		misc = { 10.838, 17.786, 3.2, 31.924, 11.772, 33 },
		miscsigns2 = { -0.003, 14.005, -6.75, 16.306, 4.809, 37.6 },
		scplogo = { -0.003, 14.005, -7.175, 16.306, 4.809, 38.45 },
		metal = { 26.4, 6.4, -12.8, 15.2, 12.8, 15.2 },
		metal3 = { 26.4, -0.4, -12.6, 15.2, 0.8, 14.8 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 17.2, 19.2 },
			range = 25,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
		{
			position = { 26.4739, 11.7239, -12.8 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 4.9, 23.2, -11 },
			range = 25,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
		{
			position = { -4.8, 23.2, -11 },
			range = 25,
			color = { 255, 50, 50 },
			brightness = 1.5,
		},
	},
	spotlights = {},
	waypoints = {
		{ -0.05, 2.4, -0.725 },
		{ 7.2, 2.4, -12.8 },
		{ 26.4, 2.4, -12.8 },
	},
	sounds = {
		{
			position = { 0, 33.6, -12.8 },
			ambience = 6,
			range = 6,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
