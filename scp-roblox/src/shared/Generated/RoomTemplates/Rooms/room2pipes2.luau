--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2pipes2",
	description = "Another variant of the two-door hallway, with caged floors and ceiling that contain various pipes.",
	shape = "2",
	commonness = 70,
	large = false,
	disableDecals = true,
	zones = { 2 },
	asset = "room2pipes2",
	boundsMin = { -6.4, -11.2, -25.6 },
	boundsMax = { 16.7875, 19.7, 25.65 },
	parts = {
		ctwalls = { -0.4, 4.8, 0, 12, 9.6, 51.2 },
		concretefloor = { 5.194, 4.25, 0, 23.188, 30.9, 51.2 },
		ctwalls2 = { 0, 14.4, 0, 12.8, 9.6, 51.2 },
		dirtymetal = { 4.294, 2.928, 0.225, 19.788, 23.056, 50.85 },
		misc = { 3.063, 8.885, -0.4, 17.374, 2.974, 40.2 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { -5.2761, 7.7, 12.8261 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
		{
			position = { -5.2761, 7.7, -12.7739 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
		{
			position = { 11.4478, 10.0239, -12.7739 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
		{
			position = { 11.4478, 10.0239, 12.8261 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
	},
	spotlights = {
		{
			position = { 0, 9.15, -20 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1,
			direction = { 0, -0.7071, -0.7071 },
			innerCone = 25,
			outerCone = 35,
		},
		{
			position = { 0, 9.15, 19.2 },
			range = 20,
			color = { 255, 200, 200 },
			brightness = 1,
			direction = { 0, -0.7071, 0.7071 },
			innerCone = 25,
			outerCone = 35,
		},
	},
	waypoints = {
		{ 0, 1.6, 0 },
	},
	sounds = {
		{
			position = { 0, -6.4, 0 },
			ambience = 1,
			range = 4,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
