--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3_3",
	description = "Another variant of a three-door hallway.",
	shape = "3",
	commonness = 20,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room3_3",
	boundsMin = { -25.6, -0.6, -10.4 },
	boundsMax = { 25.6205, 14.906, 25.6017 },
	triggerBoxes = {},
	lights = {
		{
			position = { -9.2, -0.4, 16 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 0.3,
		},
		{
			position = { -16, -0.4, 9.2 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 0.3,
		},
		{
			position = { -16, -0.4, -9.2 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 0.3,
		},
		{
			position = { 0, -0.4, -9.2 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 0.3,
		},
		{
			position = { 16, -0.4, -9.2 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 0.3,
		},
	},
	spotlights = {},
	waypoints = {},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 12.3, 12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -12.8, 12.3, 0 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 12.8, 12.3, 0 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
