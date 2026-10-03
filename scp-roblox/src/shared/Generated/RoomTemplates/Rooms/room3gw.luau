--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room3gw",
	description = "An alternate, EZ-styled, broken contamination airlock.",
	shape = "3",
	commonness = 10,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room3gw",
	boundsMin = { -25.6, -0.45, -13.6888 },
	boundsMax = { 25.975, 13.375, 25.775 },
	triggerBoxes = {},
	lights = {
		{
			position = { 1.875, 5.65, -3.1 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ -14.6, 1.6, 18.2 },
		{ 18.2, 1.6, -3.4 },
		{ -18.6, 1.6, -0.2 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 18.225, 8.3, 0.025 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -0.775, 8.3, 3.225 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -18.175, 8.3, 0.025 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -14.9, 8.3, 18.85 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "cabinet_a",
			file = "cabinet_a.x",
			position = { -5, 0, 9.7 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 4, 4, 4 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { 0.2025, 0, -0.1985 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 3.5, 3.5, 3.5 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { 3.4025, 0, 7.0015 },
			rotation = { -0.70711, 0, -0.70711, 0, 1, 0, 0.70711, 0, -0.70711 },
			scale = { 3.5, 3.5, 3.5 },
		},
	},
	playerStarts = {},
}
