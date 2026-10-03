--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3_2",
	description = "A three-door hallway, without the caged portion.",
	shape = "3",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room3_2",
	boundsMin = { -25.6, 0, -11.2 },
	boundsMax = { 25.6, 21.3708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { -0.003, 20.035, 4.811, 21.032, 2.672, 11.404 },
		pipes = { -3.144, 8.862, -8.332, 7.332, 17.674, 1.802 },
		whitewall = { 0, 10, 7.2, 51.2, 20, 36.8 },
		dirtymetal = { 0, 10.011, 5.8, 41.6, 20.022, 30 },
		white = { 0, 12.4, 6.6, 41.6, 15.2, 28.4 },
		metalpanels2 = { 0, 11.175, 7.9, 50, 4.85, 34.2 },
		concretefloor = { 0, 10, 8.2, 51.2, 20, 34.8 },
		misc = { -0.012, 19.926, 7.5, 31, 0, 16 },
		metalpanels = { -3.2, 9, -8.85, 14.4, 18, 0.7 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { -15.1142, 19.6739, 0 },
			range = 23.75,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { 15.2858, 19.6739, 0 },
			range = 23.75,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
		{
			position = { -0.012, 19.6739, 15.2023 },
			range = 23.75,
			color = { 255, 255, 255 },
			brightness = 1.4,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0.15, 1.65, 0.8 },
	},
	sounds = {
		{
			position = { -3, 8.05, -10.15 },
			ambience = 5,
			range = 3,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
