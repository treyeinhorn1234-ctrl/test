--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "008",
	description = "SCP-008's containment chamber.",
	shape = "1",
	commonness = 0,
	large = false,
	disableDecals = true,
	zones = { 2 },
	asset = "008",
	boundsMin = { -15.2, -0.8, -20.8 },
	boundsMax = { 19.6, 28.8, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 3.5739, 10.9239, 20.8 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 7.3739, 10.9239, 7.2 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 7.2739, 10.9239, -12.9 },
			range = 20,
			color = { 255, 179, 179 },
			brightness = 1,
		},
		{
			position = { -9.6261, 10.9239, -0.8 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {
		{
			position = { 0, 27.5, -0.6 },
			range = 22.5,
			color = { 255, 200, 200 },
			brightness = 1.6,
			direction = { 0, -0.866, 0.5 },
			innerCone = 80,
			outerCone = 150,
		},
	},
	waypoints = {
		{ 0.5, 14.5, -1.8 },
		{ 6.9, 1.7, 20.6 },
		{ -9.9, 1.7, 20.6 },
		{ -11.5, 1.7, 2.2 },
	},
	sounds = {
		{
			position = { 7.3, 1.7, -13 },
			ambience = 3,
			range = 4,
		},
	},
	screens = {
		{
			position = { -5.4562, 6.6, 2.8909 },
			image = "008.sc",
		},
	},
	props = {},
	playerStarts = {},
}
