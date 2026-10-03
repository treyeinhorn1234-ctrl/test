--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2gw",
	description = "A two-door contamination airlock.",
	shape = "2",
	commonness = 10,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2gw",
	boundsMin = { -13.6, -0.45, -25.6 },
	boundsMax = { 13.6, 14.375, 25.9 },
	triggerBoxes = {},
	lights = {
		{
			position = { 7.9, 10.85, 4.8 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 7.9, 10.85, -7.2 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 4, 1.6, 16 },
		{ 8.6, 1.6, 0 },
		{ 4, 1.6, -17.6 },
	},
	sounds = {
		{
			position = { 7.6, 12.8, -3.2 },
			ambience = 4,
			range = 3,
		},
	},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -0.0935, 8.3, 18.1337 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -3.2936, 9.1, -0.8663 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -0.0935, 8.3, -18.2663 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 1, 1, 1 },
		},
		{
			model = "cabinet_a",
			file = "cabinet_a.x",
			position = { -9.7685, 0, -4.8413 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 4, 4, 4 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { -0.3599, 0, -2.11 },
			rotation = { -0.86603, 0, -0.5, 0, 1, 0, 0.5, 0, -0.86603 },
			scale = { 3.7, 3.7, 3.7 },
		},
	},
	playerStarts = {},
}
