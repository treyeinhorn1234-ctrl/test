--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2Ctunnel",
	description = "A HCZ-styled corner room.",
	shape = "2C",
	commonness = 40,
	large = false,
	disableDecals = false,
	zones = { 2 },
	asset = "room2Ctunnel",
	boundsMin = { -9.6, 0, -10.0616 },
	boundsMax = { 25.6, 11.2, 25.6 },
	triggerBoxes = {},
	lights = {},
	spotlights = {
		{
			position = { 0, 10.8, 19.2 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1.3,
			direction = { 0, -1, 0 },
			innerCone = 45,
			outerCone = 95,
		},
		{
			position = { 19.2, 10.8, 0 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1.3,
			direction = { 0, -1, 0 },
			innerCone = 45,
			outerCone = 95,
		},
		{
			position = { 0, 10.8, 0 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1.3,
			direction = { 0, -1, 0 },
			innerCone = 65,
			outerCone = 105,
		},
	},
	waypoints = {
		{ 0, 1.25, 14.5 },
		{ 14.7, 1.25, 0 },
		{ 0.8, 1.25, 0.9 },
	},
	sounds = {
		{
			position = { 16, 11.25, -0.1 },
			ambience = 4,
			range = 3,
		},
		{
			position = { 0, 11.25, 15.9 },
			ambience = 4,
			range = 3,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
