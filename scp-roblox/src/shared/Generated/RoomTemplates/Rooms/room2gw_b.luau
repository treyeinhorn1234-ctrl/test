--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2gw_b",
	description = "Broken varient of the two-door contamination airlock.",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2gw_b",
	boundsMin = { -12.05, -0.45, -25.6 },
	boundsMax = { 12.125, 14.375, 25.85 },
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
	waypoints = {},
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
			position = { -1.545, 0, 2.3362 },
			rotation = { 0.70711, 0, -0.70711, 0, 1, 0, 0.70711, 0, 0.70711 },
			scale = { 3.7, 3.7, 3.7 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { -8.2002, 1.0669, 3.2365 },
			rotation = { 0, 1, 0, 0.17365, 0, -0.98481, -0.98481, 0, -0.17365 },
			scale = { 3.7, 3.7, 3.7 },
		},
	},
	playerStarts = {},
}
