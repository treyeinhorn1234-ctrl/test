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
