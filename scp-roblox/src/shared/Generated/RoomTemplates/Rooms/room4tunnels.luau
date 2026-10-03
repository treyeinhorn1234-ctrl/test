--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room4tunnels",
	description = "A four-door hallway, shaped after tunnels.",
	shape = "4",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 2 },
	asset = "room4tunnels",
	boundsMin = { -25.6, -1.6, -25.6 },
	boundsMax = { 25.6, 18.4717, 25.6 },
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
			position = { 0, 10.8, -17.6 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1.3,
			direction = { 0, -1, 0 },
			innerCone = 35,
			outerCone = 45,
		},
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
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 16.3, 0 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
