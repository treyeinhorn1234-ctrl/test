--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3tunnel",
	description = "A three-door hallway, shaped after tunnels.",
	shape = "3",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 2 },
	asset = "room3tunnel",
	boundsMin = { -25.6, 0, -10.4 },
	boundsMax = { 25.6, 18.9708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0.0261, 18.1239, -4.8 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0.0261, 18.1239, 4.8 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {
		{
			position = { 17.6, 10.8, 0 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1.3,
			direction = { 0, -1, 0 },
			innerCone = 35,
			outerCone = 45,
		},
		{
			position = { 0, 10.8, 17.6 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1.3,
			direction = { 0, -1, 0 },
			innerCone = 35,
			outerCone = 45,
		},
		{
			position = { -17.6, 10.8, 0 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1.3,
			direction = { 0, -1, 0 },
			innerCone = 35,
			outerCone = 45,
		},
	},
	waypoints = {
		{ 0, 1.6, 0 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
