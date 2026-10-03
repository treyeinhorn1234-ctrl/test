--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2poffices2",
	description = "A smaller hallway, with two doors leading to Dr. L's office and the conference rooms.",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room2poffices2",
	boundsMin = { -29.6, -0.0358, -25.6 },
	boundsMax = { 30.4, 10.9708, 25.6 },
	parts = {
		["2_office_lamps_dif"] = { 10.6, 9.635, 0.003, 22.983, 2.672, 27.432 },
		flat_monitor = { 16.437, 3.787, 2.841, 0.698, 1.576, 11.712 },
		keyboard = { 15.488, 3.077, 2.852, 0.939, 0.154, 11.658 },
		officeseat_a = { 16.622, 2.014, -0.672, 12.083, 4.1, 28.571 },
		boxfile_a = { 17.791, 3.177, 0.739, 5.422, 0.353, 18.655 },
		rockmoss = { -20.2, 4.785, -5.2, 18.8, 9.63, 29.6 },
		cabinet_a = { 7.6, 2.668, 0, 2.39, 5.337, 36.485 },
		tilefloor = { 9.8, 0, 0, 41.2, 0, 51.2 },
		officewall = { 8.4, 4.8, 0, 44, 9.6, 51.2 },
		ceiling = { 9.8, 9.6, 0, 41.2, 0, 51.2 },
		miscsigns3 = { -2.4, 7.013, -0.975, 16.1, 0.975, 12.75 },
		misc = { 9.2, 9.598, 0, 19, 0.096, 39.4 },
		metal = { 19.55, 2.885, -0.2, 12.1, 0.231, 24.2 },
		dirtymetal = { 19.536, 1.385, -0.214, 11.873, 2.769, 24.027 },
		controlpanel = { 29.56, 6.3, 0, 0.12, 3.8, 16.6 },
		papertexture = { 15.56, 3.024, 1.81, 1.809, 0.052, 1.46 },
		red = { 15.664, 3.024, 1.219, 1.601, 0.052, 0.278 },
		chatscreen = { 29.588, 6.3, -5.8, 0.025, 2.66, 3.75 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { -0.0261, 9.3239, 0 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { -0.0261, 9.3239, 19.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { -0.0261, 9.3239, -19.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 18.4261, 9.3239, 0 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 0.9, 0 },
	},
	sounds = {
		{
			position = { -21.2, 9.8, -5.15 },
			ambience = 5,
			range = 5,
		},
	},
	screens = {
		{
			position = { 29.25, 6.3, -5.8 },
			image = "conf.jpg",
		},
		{
			position = { -20.35, 5.775, 7.425 },
			image = "drl.jpg",
		},
	},
	props = {},
	playerStarts = {},
}
