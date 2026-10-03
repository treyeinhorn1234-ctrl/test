--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2_2",
	description = "An empty, two-door hallway with a large fan/vent in the wall.",
	shape = "2",
	commonness = 40,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2_2",
	boundsMin = { -20, -0.025, -25.6 },
	boundsMax = { 7.6, 18.1708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { -0.002, 16.835, -0.003, 1.786, 2.672, 27.432 },
		white = { 0.4, -0.013, 0, 13.6, 0.025, 51.2 },
		concretefloor = { 0, 8.8, 0, 15.2, 17.65, 51.2 },
		whitewall = { 0, 8.8, 0, 15.2, 17.6, 51.2 },
		dirtymetal = { -6.3, 13.2, 0, 27.4, 8, 41.6 },
		metalpanels2 = { 0, 11.175, 0, 15.2, 4.85, 50 },
		misc = { 0.024, 17.624, 0.8, 0.6, 0.096, 15.4 },
		metalpanels = { -12.1, 13.2, 0, 15.8, 8, 8 },
		controlpanel = { -4.8, 13.032, 0, 4.296, 9.115, 8 },
		vent = { 0.812, 14.375, 0, 9.625, 3.2, 49.65 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0.0217, 17.3239, -6.4 },
			range = 25,
			color = { 255, 255, 255 },
			brightness = 0.5,
		},
		{
			position = { 0.0217, 17.3239, 8 },
			range = 25,
			color = { 255, 255, 255 },
			brightness = 0.5,
		},
		{
			position = { 0.0217, 17.3239, -6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0.0217, 17.3239, -6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, 0.1 },
	},
	sounds = {
		{
			position = { -8.2, 11.6, 0 },
			ambience = 2,
			range = 6,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
