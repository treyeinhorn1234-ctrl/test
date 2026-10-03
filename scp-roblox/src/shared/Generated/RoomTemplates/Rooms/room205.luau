--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room205",
	description = "SCP-205's containment chamber.",
	shape = "1",
	commonness = 0,
	large = true,
	disableDecals = false,
	zones = { 1 },
	asset = "room205",
	boundsMin = { -44.8, -4, -21.6 },
	boundsMax = { 20, 29.6, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 12.0239, 10.9239, 17.9978 },
			range = 30,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { -7.1761, 10.9239, -6.4022 },
			range = 25,
			color = { 255, 255, 255 },
			brightness = 0.8,
		},
		{
			position = { 1.9261, 6.6, 0.3261 },
			range = 2.5,
			color = { 221, 250, 255 },
			brightness = 1,
		},
	},
	spotlights = {
		{
			position = { -28.9, 3.7, -2 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
			direction = { -1, 0, 0 },
			innerCone = 40,
			outerCone = 45,
		},
		{
			position = { -28.9, 3.7, -6.8 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
			direction = { -1, 0, 0 },
			innerCone = 40,
			outerCone = 45,
		},
	},
	waypoints = {},
	sounds = {},
	screens = {
		{
			position = { 1.9586, 6.6, 0.2956 },
			image = "205.jpg",
		},
	},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 11.6, 9.9, 0 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 11.6, 9.9, -9.6 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "205",
			file = "205.x",
			position = { -28.4047, -3.2, -6.7953 },
			rotation = { 0, 0, 1, 0, 1, 0, -1, 0, 0 },
			scale = { 120, 120, 120 },
		},
		{
			model = "205",
			file = "205.x",
			position = { -28.4047, -3.2, -1.9953 },
			rotation = { 0, 0, 1, 0, 1, 0, -1, 0, 0 },
			scale = { 120, 120, 120 },
		},
	},
	playerStarts = {},
}
