--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2pipes",
	description = "A two-door hallway, with caged floors and ceiling that contain various pipes. SCP-106 can appear out of the walls.",
	shape = "2",
	commonness = 50,
	large = false,
	disableDecals = true,
	zones = { 2 },
	asset = "room2pipes",
	boundsMin = { -7.8024, -11.225, -25.6 },
	boundsMax = { 6.4, 25.6, 25.65 },
	triggerBoxes = {},
	lights = {
		{
			position = { 5.2761, 7.7, -12.7739 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
		{
			position = { 5.2761, 7.7, 12.8261 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
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
