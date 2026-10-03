--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room513",
	description = "SCP-513's containment chamber.",
	shape = "3",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 2 },
	asset = "room513",
	boundsMin = { -25.6, -0.025, -25.6 },
	boundsMax = { 25.6, 11.7708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { -22.3783, 10.0239, 0 },
			range = 13.75,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { 0.0217, 9.9239, -16.4 },
			range = 16.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { -15.9783, 9.9239, -16.4 },
			range = 16.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
	},
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
		{ 0.8, 1.25, -1.5 },
		{ -0.8, 1.25, -9.5 },
		{ -16.8, 1.25, -14.3 },
		{ -17.6, 1.25, 0.1 },
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
