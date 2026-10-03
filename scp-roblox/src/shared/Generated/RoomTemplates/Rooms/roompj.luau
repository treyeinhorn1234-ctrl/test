--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "roompj",
	description = "SCP-372's containment chamber.",
	shape = "1",
	commonness = 0,
	large = false,
	disableDecals = true,
	zones = { 1 },
	asset = "roompj",
	boundsMin = { -25.6, -0.0141, -32 },
	boundsMax = { 25.6, 24, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 9.2, 17.6 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 20.4261, 10.1, 1.4761 },
			range = 11.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { 20.4261, 10.1, -8.1239 },
			range = 11.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { 20.4261, 10.1, -17.7239 },
			range = 11.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { -24.3783, 10.1, -17.7239 },
			range = 11.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { -24.3783, 10.1, -8.1239 },
			range = 11.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { -24.3783, 10.1, 1.4761 },
			range = 11.25,
			color = { 255, 220, 220 },
			brightness = 1.5,
		},
		{
			position = { -7.4, 11.8, -15.2 },
			range = 30,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
	},
	spotlights = {},
	waypoints = {
		{ -20.8, 1.6, -3.2 },
		{ 12, 1.6, 1.6 },
		{ 12, 1.6, -10.4 },
		{ -7.2, 1.6, -10.4 },
		{ -20.8, 1.6, -28 },
		{ 10.4, 1.6, -28.8 },
	},
	sounds = {},
	screens = {
		{
			position = { 20.3586, 6.6, 1.0956 },
			image = "372.jpg",
		},
	},
	props = {},
	playerStarts = {},
}
