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
